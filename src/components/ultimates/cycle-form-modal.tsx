"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  UltimatesCycleStatus,
  SetProductsResult,
  UltimatesCycleProductRef,
  UltimatesCycleProductSelection,
  UltimatesOfferOption,
  UltimatesOfferlessOption,
} from "@/types/ultimates";
import { unconfiguredProducts } from "@/lib/ultimates/cycle-offers";
import { OfferPicker } from "./offer-picker";
import type { CycleWithProducts, HotmartProductOption } from "./types";

interface CycleFormModalProps {
  products: HotmartProductOption[];
  editTarget?: CycleWithProducts | null;
  // O 2º argumento só vem quando o conjunto de produtos mudou: são as contagens
  // da RPC de troca. A tela usa buyers_removed para dizer quantas linhas de
  // roster sumiram — o modal já fechou quando isso precisa aparecer.
  onSave: (cycle: CycleWithProducts, products?: SetProductsResult | null) => void;
  onCancel: () => void;
  onDelete?: (cycleId: string) => void;
}

// Decisão de oferta de UM produto, viva enquanto o modal está aberto.
// `offerless` é `boolean | null` e não `boolean`: null = "ninguém decidiu
// ainda", que é o estado de todo ciclo anterior à migration 065 e o único que
// faz a faixa de aviso do dashboard existir.
interface OfferChoice {
  codes: string[];
  // Recusas JÁ PERSISTIDAS do ciclo. Existe separado de `codes` porque o submit
  // não pode reconstruir a lista de recusadas só do que a sanfona carregou:
  // quem abre a edição para renomear e salva antes das ofertas chegarem mandaria
  // `rejected: []`, e a RPC apaga toda linha ausente da seleção. As recusas
  // sumiriam e a faixa de aviso voltaria a apontar a cortesia que o gestor já
  // tinha recusado — a falha exata que a coluna `included` existe para evitar.
  rejected: string[];
  offerless: boolean | null;
}

// Ofertas carregadas de um produto. Guardadas por produto (e não numa lista
// única) porque o submit precisa saber o que a tela EXIBIU para cada um: é essa
// lista menos as marcadas que vira `rejected_offer_codes`.
interface ProductOffers {
  offers: UltimatesOfferOption[];
  offerlessCount: number;
}

const CHOICE_VAZIA: OfferChoice = { codes: [], rejected: [], offerless: null };

// Cria ou edita um ciclo (só gestor — validado nos endpoints, e a tela só
// monta este modal para role gestor). Espelha o padrão de
// src/components/indicadores/filter-modal.tsx: form + confirmação em duas
// etapas para a ação sensível (aqui, encerrar o ciclo).
// A escolha de produto usa busca + lista (padrão de link-buyer-modal.tsx),
// com seleção explícita — sem pré-seleção.
//
// Desde a migration 065 o produto não entra INTEIRO: sob cada produto
// selecionado abre uma sanfona com as ofertas dele, e o ciclo só salva quando
// todo produto tem ao menos uma escolha (PRD 3.2). A mesma invariante está nas
// RPCs — esta validação é só pela tela.
export function CycleFormModal({ products, editTarget, onSave, onCancel, onDelete }: CycleFormModalProps) {
  const isEdit = !!editTarget;
  const [name, setName] = useState(editTarget?.name ?? "");
  // Na edição, a seleção começa no conjunto ATUAL do ciclo — o modal é aberto
  // por rotina (mudar nome, mudar meta) e uma lista vazia aqui pareceria que o
  // ciclo perdeu os produtos.
  const [productIds, setProductIds] = useState<string[]>(
    editTarget?.products.map((p) => p.product_id) ?? []
  );
  // Decisões de oferta por produto. Chaveado por product_id e NUNCA podado
  // quando o produto é desmarcado: remarcar o produto devolve as ofertas que
  // já tinham sido escolhidas, para que um clique errado na lista não apague
  // trabalho (PRD 4.1).
  const [offerChoice, setOfferChoice] = useState<Record<string, OfferChoice>>(() => {
    const inicial: Record<string, OfferChoice> = {};
    for (const p of editTarget?.products ?? []) {
      inicial[p.product_id] = {
        codes: [...p.offer_codes],
        rejected: [...p.rejected_offer_codes],
        offerless: p.include_offerless,
      };
    }
    return inicial;
  });
  // Ofertas já carregadas, por produto. Cache de sessão do modal: só os
  // produtos AUSENTES daqui viram fetch, então marcar e desmarcar produto não
  // custa round-trip nem faz a sanfona piscar.
  const [offerCache, setOfferCache] = useState<Record<string, ProductOffers>>({});
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState(false);
  const [offersRetry, setOffersRetry] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [goalPercentInput, setGoalPercentInput] = useState(
    editTarget?.goal_percent != null ? String(editTarget.goal_percent) : ""
  );
  const [status, setStatus] = useState<UltimatesCycleStatus>(editTarget?.status ?? "ativo");
  // "Apenas Compras" só é escolhido na criação e é imutável depois (PRD). Na
  // edição o valor vem fixo do ciclo; no create é o estado deste interruptor.
  const [purchasesOnly, setPurchasesOnly] = useState(false);
  const isPurchasesOnly = isEdit ? !!editTarget?.purchases_only : purchasesOnly;
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  // Segundo clique exigido quando algum produto SAI do conjunto — ou, desde a
  // 065, quando alguma OFERTA sai. Os dois encolhem o universo de vendas pelo
  // mesmo caminho (recontagem da migration 062) e apagam linha de roster
  // materializada, então dividem a mesma confirmação: dois avisos separados
  // custariam dois cliques para um estrago só.
  const [confirmRemoveProducts, setConfirmRemoveProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Zona de perigo: recolhida por padrão. Este modal é aberto por rotina (mudar
  // nome, mudar meta), então o alvo de clique destrutivo não fica exposto nem
  // na mesma faixa de Cancelar/Salvar.
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Confere contra o nome PERSISTIDO (editTarget.name), nunca contra o campo
  // Nome do formulário — senão bastaria digitar qualquer coisa nos dois lugares
  // para destravar a exclusão, e a confirmação viraria enfeite.
  const deleteConfirmed = isEdit && deleteConfirmText.trim() === editTarget!.name;

  // Filtro local (nome ou ID, case-insensitive) — a lista completa de produtos
  // ativos já chega via props, então não há round-trip de API na busca.
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (q === "") return products;
    return products.filter(
      (p) => p.product_name.toLowerCase().includes(q) || p.product_id.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Derivada, não guardada em estado: zerar a seleção destrava sozinho, sem
  // um segundo setState que pudesse ficar dessincronizado da lista.
  const lockedAccountId =
    products.find((p) => p.product_id === productIds[0])?.account_id ?? null;

  function toggleProduct(productId: string) {
    setProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }

  function toggleOffer(productId: string, offerCode: string) {
    setOfferChoice((prev) => {
      const atual = prev[productId] ?? CHOICE_VAZIA;
      const codes = atual.codes.includes(offerCode)
        ? atual.codes.filter((c) => c !== offerCode)
        : [...atual.codes, offerCode];
      return { ...prev, [productId]: { ...atual, codes } };
    });
  }

  function toggleOfferless(productId: string) {
    setOfferChoice((prev) => {
      const atual = prev[productId] ?? CHOICE_VAZIA;
      return { ...prev, [productId]: { ...atual, offerless: atual.offerless !== true } };
    });
  }

  // Produtos selecionados cujas ofertas ainda não chegaram. String (e não
  // array) porque é dependência de efeito: um array novo a cada render
  // refaria o fetch para sempre.
  const missingKey = productIds
    .filter((id) => !(id in offerCache))
    .slice()
    .sort()
    .join(",");

  useEffect(() => {
    if (missingKey === "") return;
    let cancelled = false;

    async function load() {
      // setState dentro da função async, e não no corpo síncrono do efeito —
      // react-hooks/set-state-in-effect rejeita setState direto ali (mesmo
      // contorno das cargas de ultimates-dashboard.tsx).
      setOffersLoading(true);
      setOffersError(false);
      const ids = missingKey.split(",");
      try {
        const res = await fetch(
          `/api/ultimates/offer-options?productIds=${encodeURIComponent(missingKey)}`
        );
        if (cancelled) return;
        if (!res.ok) {
          setOffersError(true);
          setOffersLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const offers: UltimatesOfferOption[] = Array.isArray(data?.offers) ? data.offers : [];
        const offerless: UltimatesOfferlessOption[] = Array.isArray(data?.offerless)
          ? data.offerless
          : [];
        setOfferCache((prev) => {
          const next = { ...prev };
          // Todo id pedido entra no cache, inclusive o que não voltou com
          // oferta nenhuma: sem isso ele ficaria eternamente "faltando" e o
          // efeito refaria o mesmo fetch a cada render.
          for (const id of ids) {
            next[id] = {
              offers: offers.filter((o) => o.product_id === id),
              offerlessCount: offerless.find((o) => o.product_id === id)?.sales_count ?? 0,
            };
          }
          return next;
        });
        setOffersLoading(false);
      } catch {
        if (cancelled) return;
        setOffersError(true);
        setOffersLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [missingKey, offersRetry]);

  // Ciclo encerrado é histórico: trocar o produto (ou a oferta) reescreveria
  // todos os números dele de uma vez. O mesmo gate de canWrite que já bloqueia
  // upload, vínculo e refresh (a RPC repete a regra — esta checagem é só pela
  // tela).
  const canEditProducts = !isEdit || editTarget!.status === "ativo";

  // O que vai no corpo da requisição: conjunto COMPLETO de produtos com suas
  // decisões, nunca um delta (o diff é feito no banco).
  //
  // `rejected_offer_codes` é o que a tela CARREGOU para o produto menos o que
  // ficou marcado. É a única informação que o servidor não consegue derivar
  // sozinho — "recusei" e "nunca vi" são indistinguíveis do lado de lá, e é
  // essa distinção que impede a faixa de aviso do dashboard de gritar para
  // sempre por uma cortesia desmarcada de propósito.
  const productSelection = useMemo<UltimatesCycleProductSelection[]>(
    () =>
      productIds.map((id) => {
        const choice = offerChoice[id] ?? CHOICE_VAZIA;
        const carregadas = offerCache[id];
        const exibidas = carregadas?.offers.map((o) => o.offer_code) ?? [];
        return {
          product_id: id,
          offer_codes: choice.codes,
          // União das recusas JÁ persistidas com as que a tela acabou de exibir
          // sem marcação — nas duas, o que está marcado agora sai fora (marcar
          // uma oferta antes recusada é justamente desfazer a recusa).
          //
          // A parcela persistida é o que protege quem salva antes da sanfona
          // carregar: sem ela, `exibidas` seria [] e a RPC apagaria todas as
          // recusas do ciclo.
          rejected_offer_codes: Array.from(
            new Set([...choice.rejected, ...exibidas])
          ).filter((code) => !choice.codes.includes(code)),
          // A linha "(sem oferta)" só é exibida para produto que tem venda sem
          // offer_code. Quando ela não aparece, não houve decisão a tomar e o
          // valor vigente é preservado — zerar para `false` aqui apagaria em
          // silêncio uma escolha antiga só porque o produto parou de ter
          // vendas nessa condição.
          include_offerless:
            carregadas && carregadas.offerlessCount > 0 ? choice.offerless === true : choice.offerless,
        };
      }),
    [productIds, offerChoice, offerCache]
  );

  // Produtos sem escolha nenhuma. A regra mora em cycle-offers.ts porque as
  // rotas de criação/edição respondem com ela também, e as duas telas do
  // fluxo precisam concordar sobre o que é "configurado".
  const semEscolha = useMemo(() => unconfiguredProducts(productSelection), [productSelection]);
  const semEscolhaIds = semEscolha.map((p) => p.product_id);

  function productLabel(productId: string): string {
    return products.find((p) => p.product_id === productId)?.product_name ?? productId;
  }

  function offerLabel(productId: string, offerCode: string): string {
    return (
      offerCache[productId]?.offers.find((o) => o.offer_code === offerCode)?.offer_name ?? offerCode
    );
  }

  // Produtos que estavam no ciclo e não estão mais na seleção. Derivado do
  // editTarget PERSISTIDO, não de um snapshot em estado, para não descolar da
  // realidade se o ciclo for recarregado por baixo.
  const removedProducts = isEdit
    ? editTarget!.products.filter((p) => !productIds.includes(p.product_id))
    : [];

  // Ofertas que SAEM de um produto que CONTINUA no ciclo. Produto inteiro
  // saindo já está coberto pela lista acima — repetir suas ofertas aqui
  // nomearia duas vezes a mesma perda.
  const removedOffers = useMemo(() => {
    if (!isEdit) return [] as string[];
    const porProduto = new Map(productSelection.map((s) => [s.product_id, s]));
    const saindo: string[] = [];
    for (const p of editTarget!.products) {
      const selecao = porProduto.get(p.product_id);
      if (!selecao) continue;
      for (const code of p.offer_codes) {
        if (!selecao.offer_codes.includes(code)) saindo.push(offerLabel(p.product_id, code));
      }
      if (p.include_offerless === true && selecao.include_offerless !== true) {
        saindo.push(`${productLabel(p.product_id)} · (sem oferta)`);
      }
    }
    return saindo;
    // offerLabel/productLabel leem offerCache e products, já nas dependências
    // por via de productSelection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editTarget, productSelection, offerCache, products]);

  // Houve mudança no conjunto de produtos OU em qualquer decisão de oferta.
  // `rejected_offer_codes` entra na comparação de propósito: revisar uma oferta
  // nova e recusá-la não muda nada visível, mas é justamente a escrita que
  // desliga a faixa de aviso do dashboard.
  const productsChanged =
    isEdit &&
    (removedProducts.length > 0 ||
      productIds.length !== editTarget!.products.length ||
      productSelection.some((selecao) => {
        const atual = editTarget!.products.find((p) => p.product_id === selecao.product_id);
        if (!atual) return true;
        return (
          !mesmoConjunto(atual.offer_codes, selecao.offer_codes) ||
          !mesmoConjunto(atual.rejected_offer_codes, selecao.rejected_offer_codes) ||
          atual.include_offerless !== selecao.include_offerless
        );
      }));

  // Chave estável das decisões de oferta, para o efeito abaixo. String pelo
  // mesmo motivo de missingKey: um objeto novo a cada render derrubaria a
  // confirmação sem ninguém ter mexido em nada.
  const offerChoiceKey = productSelection
    .map(
      (s) =>
        `${s.product_id}:${s.offer_codes.slice().sort().join("|")}:${s.include_offerless === null ? "?" : s.include_offerless}`
    )
    .join(";");

  // Mexer no formulário derruba as duas confirmações: elas valem para o
  // conjunto de mudanças que estava na tela quando o gestor as leu, não para
  // qualquer estado futuro. A seleção de OFERTAS entra aqui pela mesma razão —
  // sem isso, ler o aviso "sai a Cortesia" e depois desmarcar outra oferta
  // confirmaria uma perda que ninguém nomeou.
  useEffect(() => {
    setConfirmEncerrar(false);
    setConfirmRemoveProducts(false);
  }, [name, productIds, goalPercentInput, status, offerChoiceKey]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function parseGoalPercent(): number | null | "invalid" {
    const trimmed = goalPercentInput.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0 || n > 100) return "invalid";
    return n;
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    // Vale na criação E na edição: um ciclo sem produto nenhum não dá erro em
    // lugar nenhum, só carrega o dashboard zerado.
    if (canEditProducts && productIds.length === 0) {
      setError("Selecione ao menos um produto.");
      return;
    }
    // Produto sem oferta escolhida não salva (PRD 3.2). A mensagem NOMEIA os
    // produtos: com a sanfona recolhida — ou fora do filtro de busca — "algum
    // produto está sem oferta" mandaria abrir todas para descobrir qual.
    if (canEditProducts && semEscolha.length > 0) {
      setError(
        `Selecione ao menos 1 oferta em: ${semEscolhaIds.map(productLabel).join(", ")}.`
      );
      return;
    }
    const goalPercent = parseGoalPercent();
    if (goalPercent === "invalid") {
      setError("Meta deve ser um número entre 0 e 100, ou vazia.");
      return;
    }

    // Encerrar congela a operação do ciclo — exige confirmação explícita
    // (segundo clique), mesmo padrão de aviso-de-duas-etapas do filter-modal.
    if (isEdit && status === "encerrado" && editTarget!.status !== "encerrado" && !confirmEncerrar) {
      setConfirmEncerrar(true);
      return;
    }

    // Remover produto — ou desmarcar oferta — apaga do roster os compradores
    // que só existiam por causa dele. Os nomes do que sai ficam na tela junto
    // do segundo clique: sem isso o gestor confirmaria uma perda sem saber de
    // onde ela vem.
    if ((removedProducts.length > 0 || removedOffers.length > 0) && !confirmRemoveProducts) {
      setConfirmRemoveProducts(true);
      return;
    }

    setError("");
    setSaving(true);
    try {
      const url = isEdit ? `/api/ultimates/cycles/${editTarget!.id}` : "/api/ultimates/cycles";
      const method = isEdit ? "PATCH" : "POST";
      // `products` só entra no PATCH se alguma decisão mudou: a RPC de troca
      // apaga e materializa comprador, e mandá-la a cada renomeação de ciclo
      // seria pagar esse trabalho — e esse risco — à toa.
      const body = isEdit
        ? productsChanged
          ? { name: name.trim(), goalPercent, status, products: productSelection }
          : { name: name.trim(), goalPercent, status }
        : { name: name.trim(), products: productSelection, goalPercent, purchasesOnly };

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Erro ao salvar ciclo.");
        return;
      }

      const savedRaw = data?.cycle as CycleWithProducts | undefined;
      if (!savedRaw) {
        setError("Erro ao salvar ciclo.");
        return;
      }
      // A rota devolve só a linha do ciclo; os nomes dos produtos já estão
      // aqui na prop, então montamos o formato da tela sem um GET extra. Na
      // edição SEM troca o conjunto é o de antes; com troca, é o que acabou de
      // ser enviado.
      const savedProducts: UltimatesCycleProductRef[] =
        isEdit && !productsChanged
          ? editTarget!.products
          : productSelection.map((selecao) => ({
              product_id: selecao.product_id,
              product_name:
                products.find((p) => p.product_id === selecao.product_id)?.product_name ?? null,
              offer_codes: selecao.offer_codes,
              rejected_offer_codes: selecao.rejected_offer_codes,
              include_offerless: selecao.include_offerless,
            }));
      onSave(
        { ...savedRaw, products: savedProducts },
        (data?.products as SetProductsResult | null | undefined) ?? null
      );
    } catch {
      setError("Falha de rede ao salvar o ciclo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !deleteConfirmed) return;

    setDeleteError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/ultimates/cycles/${editTarget!.id}`, { method: "DELETE" });

      // 404 conta como sucesso: o objetivo era "este ciclo não existir mais".
      // Se outra aba (ou outro gestor) já o excluiu, insistir em erro só deixaria
      // a tela presa exibindo um fantasma.
      if (res.ok || res.status === 404) {
        onDelete?.(editTarget!.id);
        return;
      }

      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? "Erro ao excluir ciclo.");
    } catch {
      setDeleteError("Falha de rede ao excluir o ciclo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="ult-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 440 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          {isEdit ? "Editar ciclo" : "Novo ciclo"}
        </h3>

        {!isEdit && (
          <div>
            <button
              type="button"
              aria-pressed={purchasesOnly}
              onClick={() => setPurchasesOnly((v) => !v)}
              data-testid="cycle-form-purchases-only"
              className={purchasesOnly ? "btn-primary" : "btn-secondary"}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
            >
              <span>Apenas Compras</span>
              <span style={{ opacity: 0.7, fontSize: 12 }}>{purchasesOnly ? "Ligado" : "Desligado"}</span>
            </button>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
              Sem base de renovação: toda compra aprovada do produto entra no Roster automaticamente. Definido só na criação — não muda depois.
            </p>
          </div>
        )}

        {isEdit && editTarget?.purchases_only && (
          <p
            data-testid="cycle-form-purchases-only-readonly"
            style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}
          >
            Modo: <strong>Apenas Compras</strong> (definido na criação, imutável)
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
            Nome
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Renovação Julho/2026"
            className="field-control"
            data-testid="cycle-form-name"
          />
        </div>

        {/* Ciclo encerrado mostra o conjunto, mas não deixa mexer: trocar o
            produto ou a oferta reescreveria todos os números de um histórico
            fechado. As ofertas são EXIBIDAS aqui, e não só as contagens: quem
            abre um ciclo antigo precisa saber o que ele estava contando. */}
        {isEdit && !canEditProducts && (
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Produtos Hotmart
            </label>
            <p
              data-testid="cycle-form-products-readonly"
              style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}
            >
              {editTarget!.products.map((p) => p.product_name ?? p.product_id).join(" · ")}
              <br />
              Ciclo encerrado — reative o ciclo para alterar os produtos.
            </p>
            <ul
              data-testid="cycle-form-offers-readonly"
              style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}
            >
              {editTarget!.products.map((p) => (
                <li key={p.product_id} style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-strong)" }}>
                    {p.product_name ?? p.product_id}
                  </strong>
                  :{" "}
                  {[
                    ...p.offer_codes.map((code) => offerLabel(p.product_id, code)),
                    ...(p.include_offerless === true ? ["(sem oferta)"] : []),
                  ].join(" · ") || "nenhuma oferta escolhida"}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 0", lineHeight: 1.5 }}>
              Ciclo encerrado — reative o ciclo para alterar as ofertas.
            </p>
          </div>
        )}

        {canEditProducts && (
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Produtos Hotmart (1 ou mais)
            </label>
            {products.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
                Nenhum produto disponível
              </p>
            ) : (
              <>
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar por nome ou ID..."
                  className="field-control"
                  data-testid="cycle-form-product-search"
                />
                <ul
                  style={{
                    listStyle: "none",
                    margin: "8px 0 0",
                    padding: 0,
                    maxHeight: 320,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {filteredProducts.length === 0 && (
                    <li style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      Nenhum produto encontrado.
                    </li>
                  )}
                  {filteredProducts.map((p) => {
                    const selected = productIds.includes(p.product_id);
                    const blocked = lockedAccountId !== null && p.account_id !== lockedAccountId;
                    const invalid = selected && semEscolhaIds.includes(p.product_id);
                    const carregadas = offerCache[p.product_id];
                    return (
                      <li
                        key={p.product_id}
                        // A borda de erro fica NO ITEM do produto, e não só no
                        // rodapé: é onde o problema nasce e onde ele se
                        // resolve, sem obrigar a caçar o produto pelo nome.
                        style={{
                          borderRadius: "var(--radius-sm)",
                          border: invalid
                            ? "1px solid color-mix(in srgb, var(--color-danger) 55%, transparent)"
                            : "1px solid transparent",
                          padding: invalid ? 4 : 0,
                        }}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          disabled={blocked}
                          title={
                            blocked
                              ? "Produto de outra conta Hotmart. Um ciclo acompanha produtos de uma conta só."
                              : undefined
                          }
                          className={selected ? "btn-primary" : "btn-secondary"}
                          data-testid={`cycle-form-product-option-${p.product_id}`}
                          onClick={() => toggleProduct(p.product_id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            fontSize: 13,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            opacity: blocked ? 0.45 : 1,
                            cursor: blocked ? "not-allowed" : "pointer",
                          }}
                        >
                          <span>{p.product_name}</span>
                          <span style={{ opacity: 0.7 }}>{p.product_id}</span>
                        </button>

                        {selected && (
                          <OfferPicker
                            productId={p.product_id}
                            offers={carregadas?.offers ?? []}
                            offerlessCount={carregadas?.offerlessCount ?? 0}
                            selectedOfferCodes={(offerChoice[p.product_id] ?? CHOICE_VAZIA).codes}
                            includeOfferless={
                              (offerChoice[p.product_id] ?? CHOICE_VAZIA).offerless === true
                            }
                            loading={!carregadas && offersLoading}
                            loadError={!carregadas && offersError}
                            invalid={invalid}
                            onToggleOffer={(code) => toggleOffer(p.product_id, code)}
                            onToggleOfferless={() => toggleOfferless(p.product_id)}
                            onRetry={() => setOffersRetry((t) => t + 1)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
                {productIds.length > 0 && (
                  <p
                    data-testid="cycle-form-product-selected"
                    style={{ fontSize: 12, color: "var(--color-text)", margin: "6px 0 0" }}
                  >
                    Selecionados:{" "}
                    <strong>
                      {productIds
                        .map((id) => products.find((p) => p.product_id === id)?.product_name ?? id)
                        .join(", ")}
                    </strong>{" "}
                    ({productIds.length})
                  </p>
                )}
                {lockedAccountId !== null && (
                  <p
                    data-testid="cycle-form-account-lock"
                    style={{ fontSize: 11, color: "var(--color-warning)", margin: "4px 0 0" }}
                  >
                    Conta travada pelo 1º produto selecionado — um ciclo acompanha produtos de uma conta só.
                  </p>
                )}
              </>
            )}
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
              Produto recém-criado não aparece? Rode o sync em{" "}
              <code>/api/hotmart/sync-products</code> e tente novamente.
            </p>
          </div>
        )}

        {!isPurchasesOnly && (
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Meta de renovação (%) — opcional
            </label>
            <input
              value={goalPercentInput}
              onChange={(e) => setGoalPercentInput(e.target.value)}
              placeholder="Ex: 60"
              inputMode="decimal"
              className="field-control"
              data-testid="cycle-form-goal"
            />
          </div>
        )}

        {isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Status
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["ativo", "encerrado"] as UltimatesCycleStatus[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={status === opt}
                  onClick={() => setStatus(opt)}
                  data-testid={`cycle-form-status-${opt}`}
                  className={status === opt ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                >
                  {opt === "ativo" ? "Ativo" : "Encerrado"}
                </button>
              ))}
            </div>
          </div>
        )}

        {confirmEncerrar && (
          <p
            role="status"
            data-testid="cycle-form-confirm-encerrar"
            style={{
              fontSize: 12,
              color: "var(--color-warning)",
              margin: 0,
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)",
              background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
              lineHeight: 1.5,
            }}
          >
            Encerrar congela a operação deste ciclo — o dashboard continua acessível, só upload/vínculo/atualização ficam bloqueados. Clique em Salvar novamente para confirmar.
          </p>
        )}

        {/* Nomeia os produtos e as ofertas que SAEM, não só a quantidade: o
            gestor precisa reconhecer o que está prestes a perder, e "1 produto
            será removido" não permite isso. A contagem de compradores apagados
            não cabe aqui — ela só existe depois que a RPC roda. */}
        {confirmRemoveProducts && (
          <p
            role="status"
            data-testid="cycle-form-confirm-remove-products"
            style={{
              fontSize: 12,
              color: "var(--color-warning)",
              margin: 0,
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)",
              background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
              lineHeight: 1.5,
            }}
          >
            {removedProducts.length > 0 && (
              <>
                Sai do ciclo:{" "}
                <strong>
                  {removedProducts.map((p) => p.product_name ?? p.product_id).join(" · ")}
                </strong>
                . As compras desse produto deixam de contar, e os compradores que só existiam por
                causa dele saem do roster.{" "}
              </>
            )}
            {removedOffers.length > 0 && (
              <>
                Sai da contabilidade:{" "}
                <strong data-testid="cycle-form-confirm-remove-offers">
                  {removedOffers.join(" · ")}
                </strong>
                . As compras dessas ofertas deixam de contar, e os compradores que só existiam por
                causa delas saem do roster.{" "}
              </>
            )}
            Vínculos manuais são preservados — remarcar devolve tudo na leitura seguinte. Clique em
            Salvar novamente para confirmar.
          </p>
        )}

        {error && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{error}</p>}

        <div className="ult-modal-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" data-testid="cycle-form-cancel">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="btn-primary"
            data-testid="cycle-form-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {isEdit && onDelete && (
          <div
            style={{
              marginTop: 4,
              paddingTop: 12,
              borderTop: "1px solid var(--color-border, var(--border-vis))",
            }}
          >
            {!dangerOpen ? (
              <button
                type="button"
                onClick={() => setDangerOpen(true)}
                data-testid="cycle-form-delete-open"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 12,
                  fontFamily: "inherit",
                  color: "var(--color-danger)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Excluir ciclo
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p
                  data-testid="cycle-form-delete-warning"
                  style={{
                    fontSize: 12,
                    color: "var(--color-danger)",
                    margin: 0,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)",
                    background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                    lineHeight: 1.5,
                  }}
                >
                  Excluir apaga o ciclo <strong>para sempre</strong>, junto com a base de
                  compradores, os vínculos manuais, as ofertas escolhidas e os compradores
                  excluídos. Não há como desfazer. Para só congelar a operação sem perder nada,
                  use o status <strong>Encerrado</strong>.
                </p>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                  Digite <strong>{editTarget!.name}</strong> para confirmar
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={editTarget!.name}
                  className="field-control"
                  data-testid="cycle-form-delete-confirm-input"
                />
                {deleteError && (
                  <p
                    data-testid="cycle-form-delete-error"
                    style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}
                  >
                    {deleteError}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDangerOpen(false);
                      setDeleteConfirmText("");
                      setDeleteError("");
                    }}
                    className="btn-secondary"
                    data-testid="cycle-form-delete-cancel"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!deleteConfirmed || deleting}
                    data-testid="cycle-form-delete-confirm"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-danger)",
                      background: "var(--color-danger)",
                      color: "#fff",
                      cursor: !deleteConfirmed || deleting ? "not-allowed" : "pointer",
                      opacity: !deleteConfirmed || deleting ? 0.5 : 1,
                    }}
                  >
                    {deleting ? "Excluindo..." : "Excluir definitivamente"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Comparação por CONJUNTO, não por ordem: a ordem de offer_codes é a ordem em
// que o gestor clicou, e uma diferença só de ordem mandaria a RPC de troca
// rodar — apagando e materializando roster — sem nenhuma mudança real.
function mesmoConjunto(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}
