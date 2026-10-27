-- UP
-- Central de Links na V2: cada grupo vira uma pasta (um nível só). Só acrescenta; o projeto antigo da Central,
-- que usa as mesmas tabelas, segue funcionando e ignora as colunas e a função novas.

-- Cor da pasta (mesma paleta das pastas dos Eventos). Nula = cor padrão da tela.
alter table central_grupo_order
  add column if not exists cor text;

alter table central_grupo_order drop constraint if exists central_grupo_order_cor_check;
alter table central_grupo_order add constraint central_grupo_order_cor_check
  check (cor is null or cor in ('azul', 'ciano', 'verde', 'indigo', 'violeta', 'rosa', 'coral', 'ardosia'));

-- Miniatura da página: imagem tirada da cópia arquivada, guardada no bucket "paginas" (miniaturas/<id>.png).
alter table central_links
  add column if not exists miniatura_path text;

-- Os grupos eram numerados dentro de cada pasta antiga. Na V2 a lista é uma só: numera de 0 a n-1
-- seguindo a ordem que o usuário já via (pastas em ordem e, depois, os grupos soltos).
-- Roda uma única vez (marcador em central_migracoes) e preserva a ordem relativa dentro de cada pasta antiga.
do $$
begin
  if not exists (select 1 from central_migracoes where nome = 'v2_pastas_lista_unica') then
    update central_grupo_order g
       set position = r.nova
      from (
        select o.grupo,
               (row_number() over (
                 order by (p.nome is null), coalesce(p.position, 0), coalesce(p.nome, ''), o.position, o.grupo
               ) - 1)::integer as nova
          from central_grupo_order o
          left join central_pastas p on p.nome = o.pasta
      ) r
     where r.grupo = g.grupo;
    insert into central_migracoes (nome) values ('v2_pastas_lista_unica');
  end if;
end $$;

-- Renomeia a pasta e os links dela numa transação só. Roda com as permissões de quem chama:
-- a RLS de central_grupo_order e central_links já limita a escrita ao admin da Central.
create or replace function central_renomear_pasta(p_de text, p_para text)
returns void
language plpgsql
security invoker
as $$
declare
  v_para text := btrim(p_para);
  v_linhas integer;
begin
  if v_para = '' or char_length(v_para) > 30 then
    raise exception 'Nome de pasta inválido.' using errcode = '22023';
  end if;
  if lower(v_para) <> lower(btrim(p_de)) and exists (
    select 1 from central_grupo_order where lower(grupo) = lower(v_para)
  ) then
    raise exception 'Já existe uma pasta com esse nome.' using errcode = '23505';
  end if;

  update central_grupo_order set grupo = v_para where grupo = p_de;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Sem permissão para esta ação.' using errcode = '42501';
  end if;

  update central_links set grupo = v_para where grupo = p_de;
end;
$$;

revoke all on function central_renomear_pasta(text, text) from public;
grant execute on function central_renomear_pasta(text, text) to authenticated;

-- DOWN
-- drop function if exists central_renomear_pasta(text, text);
-- alter table central_links drop column if exists miniatura_path;
-- alter table central_grupo_order drop constraint if exists central_grupo_order_cor_check;
-- alter table central_grupo_order drop column if exists cor;
