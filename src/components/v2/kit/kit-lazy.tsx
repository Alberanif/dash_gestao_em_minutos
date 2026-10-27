"use client";

import dynamic from "next/dynamic";

// O kit usa todos os primitivos e o Motion de uma vez; carregado sob demanda para não pesar
// no JS inicial da rota (é página interna de validação visual).
export const KitDemoLazy = dynamic(() => import("./kit-demo").then((m) => m.KitDemo));

// Mesma razão para o catálogo de gráficos: todos os gráficos e o Motion de uma vez.
export const ChartsDemoLazy = dynamic(() => import("./charts-demo").then((m) => m.ChartsDemo));
