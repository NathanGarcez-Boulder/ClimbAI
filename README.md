# ClimbAI 🧗

**Coach de escalada com IA** — análise biomecânica de vídeo para escaladores de todos os níveis.

## O que é

O ClimbAI democratiza o coaching de escalada usando visão computacional e IA. Você envia um vídeo do seu treino e recebe em segundos:

- **Análise biomecânica** — postura, eficiência de quadril, tensão muscular, arm reach
- **Visualização de forças** — distribuição de carga entre membros e core
- **Insights acionáveis** — pontos fortes, melhorias e alertas de lesão

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite |
| Análise IA | Anthropic Claude (Vision) |
| Estilo | CSS-in-JS puro (sem biblioteca) |
| Roteamento | Estado local (sem react-router por enquanto) |

## Início rápido

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/climbai.git
cd climbai

# 2. Instale as dependências
npm install

# 3. Configure a API key
cp .env.example .env
# Edite .env e adicione sua VITE_ANTHROPIC_API_KEY

# 4. Rode em desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Estrutura do projeto

```
src/
├── components/
│   ├── upload/       # UploadTab — seleção e envio de vídeos
│   ├── analysis/     # AnalysisTab — métricas e insights biomecânicos
│   ├── physics/      # PhysicsTab — distribuição de forças e CoG
│   ├── plans/        # PlansTab — tiers de assinatura
│   └── shared/       # Topbar, Nav
├── hooks/
│   └── useAnalysis.js  # Hook de análise com fallback para mock
├── services/
│   ├── anthropic.js    # Integração com a API do Claude
│   └── mockData.js     # Dados mock para desenvolvimento
└── styles/
    └── global.css      # Reset + variáveis CSS
```

## Planos

| Plano | Preço | Vídeos |
|-------|-------|--------|
| Free | Grátis | 3/mês |
| Individual | R$29/mês | Ilimitados |
| Academia | R$149/mês | Ilimitados · 20 alunos |

## ⚠️ Nota de segurança

A API key do Anthropic nunca deve ser exposta no frontend em produção. Implemente um backend (Node/Edge Function) para fazer o proxy das requisições antes de publicar.

## Roadmap

- [ ] Análise de respiração
- [ ] Tracking de pose em tempo real (MediaPipe)
- [ ] Relatório PDF semanal
- [ ] Painel do treinador (plano Academia)
- [ ] App mobile (React Native)

## Licença

MIT
