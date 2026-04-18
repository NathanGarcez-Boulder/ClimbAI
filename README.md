# ClimbAI

**Coach de escalada com IA** — análise biomecânica de vídeo para escaladores de todos os níveis.

O ClimbAI democratiza o coaching de escalada usando visão computacional, física aplicada e IA generativa. Você envia um vídeo do treino e recebe em segundos análise biomecânica detalhada, distribuição de forças por membro, torques articulares e alerta de risco de lesão por dedo.

---

## Sumário

1. [Stack tecnológica](#stack-tecnológica)
2. [Início rápido](#início-rápido)
3. [Estrutura do projeto](#estrutura-do-projeto)
4. [Pipeline de análise](#pipeline-de-análise)
5. [Motor de física — physics.js](#motor-de-física--physicsjs)
   - [Centro de Gravidade (CoG)](#1-centro-de-gravidade-cog)
   - [Detecção de contatos](#2-detecção-de-contatos)
   - [Distribuição de forças — IDW](#3-distribuição-de-forças--idw)
   - [Torques articulares](#4-torques-articulares)
   - [Carga dos dedos — Finger Load](#5-carga-dos-dedos--finger-load)
   - [Score composto](#6-score-composto-0100)
   - [Calibração pixel → metro](#7-calibração-pixel--metro)
6. [Serviços](#serviços)
7. [Planos e preços](#planos-e-preços)
8. [Roadmap de sprints](#roadmap-de-sprints)
9. [Referências científicas](#referências-científicas)
10. [Segurança](#segurança)
11. [Licença](#licença)

---

## Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite 5 |
| Análise IA | Anthropic Claude Vision (claude-opus-4-5) |
| Motor de física | `src/services/physics.js` (vanilla JS, zero dependências) |
| Estilo | CSS-in-JS puro (sem biblioteca externa) |
| Build | Vite — HMR, ESM nativo |

---

## Início rápido

```bash
# 1. Clone o repositório
git clone https://github.com/NathanGarcez-Boulder/ClimbAI.git
cd ClimbAI

# 2. Instale as dependências
npm install

# 3. Configure a API key
cp .env.example .env
# Edite .env e adicione sua VITE_ANTHROPIC_API_KEY

# 4. Rode em desenvolvimento
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173).

```bash
# Build para produção
npm run build

# Preview do build
npm run preview
```

---

## Estrutura do projeto

```
ClimbAI/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── src/
    ├── App.jsx                        # Roteamento por estado, layout raiz
    ├── main.jsx                       # Entry point React
    ├── components/
    │   ├── upload/
    │   │   └── UploadTab.jsx          # Seleção e envio de vídeos
    │   ├── analysis/
    │   │   └── AnalysisTab.jsx        # Métricas e insights biomecânicos
    │   ├── physics/
    │   │   └── PhysicsTab.jsx         # Visualização de forças e CoG
    │   ├── plans/
    │   │   └── PlansTab.jsx           # Tiers de assinatura
    │   └── shared/
    │       ├── Topbar.jsx             # Cabeçalho global
    │       └── Nav.jsx                # Navegação entre abas
    ├── hooks/
    │   └── useAnalysis.js             # Hook: análise com fallback para mock
    ├── services/
    │   ├── anthropic.js               # Integração Anthropic Claude Vision API
    │   ├── physics.js                 # Motor de fisica e biomecânica
    │   └── mockData.js                # Dados mock para desenvolvimento offline
    └── styles/
        └── global.css                 # Reset + paleta de cores + variáveis CSS
```

---

## Pipeline de análise

Cada frame de vídeo percorre este pipeline antes de chegar ao overlay:

```
[Frame de vídeo]
      |
      v
[Extração de keypoints — RTMPose 133pt]
      |
      v
[Cálculo do CoG — Centro de Gravidade]          physics.calculateCoG()
      |
      v
[Detecção de contatos — velocidade px/frame]    physics.detectContacts()
      |
      v
[Distribuição de forças — IDW]                  physics.calculateIDW()
      |
      v
[Torques articulares — τ = r × F × |sin θ|]    physics.calcTorques()
      |
      v
[Carga dos dedos — Finger Load]                 physics.calcFingerLoad()
      |
      v
[Score composto + alertas de risco]             physics.calcCompositeScore()
      |
      v
[Renderização do overlay no canvas]
```

---

## Motor de física — physics.js

Arquivo: `src/services/physics.js`

Zero dependências externas. Todo o cálculo é feito em JS puro com validação matemática explícita. As constantes biomecânicas são baseadas em literatura peer-reviewed.

### Constantes exportadas

```js
import {
  SEGMENT_RATIOS,      // Razões de massa por segmento (De Leva 1996)
  SEGMENT_LENGTHS,     // Comprimentos de referência em metros
  GRIP_WEIGHTS,        // Distribuição de carga por tipo de pega (Chao 1989)
  PULLEY_LIMITS_KG,    // Limites do pulley A2 por dedo [kg]
  VELOCITY_THRESHOLD,  // px/frame para considerar membro em contato (default: 5)
} from './services/physics.js'
```

---

### 1. Centro de Gravidade (CoG)

```js
calculateCoG(keypoints, bodyWeight) → { x: number, y: number }
```

**Fórmula:**

```
CoG = Σ(ratio_i × centro_i) / Σ(ratio_i)
```

- `ratio_i` — razão de massa do segmento (De Leva 1996)
- `centro_i` — ponto médio entre o keypoint proximal e distal do segmento
- Divisão pelo somatório real das razões (≈ 0.98, não 1.0) — elimina bias de 2% quando nem todo o corpo está visível no frame

**Mapeamento de keypoints RTMPose → segmentos:**

| Segmento | Razão | Keypoints |
|----------|-------|-----------|
| Cabeça | 8.0% | 0 (nariz) |
| Tronco | 50.0% | média(5, 6, 11, 12) |
| Braço sup. dir. | 2.7% | média(5, 7) |
| Braço sup. esq. | 2.7% | média(6, 8) |
| Antebraço dir. | 2.3% | média(7, 9) |
| Antebraço esq. | 2.3% | média(8, 10) |
| Coxa dir. | 10.0% | média(11, 13) |
| Coxa esq. | 10.0% | média(12, 14) |
| Tíbia dir. | 5.0% | média(13, 15) |
| Tíbia esq. | 5.0% | média(14, 16) |

Keypoints com `score < 0.1` são automaticamente ignorados.

---

### 2. Detecção de contatos

```js
detectContacts(currentKps, previousKps, threshold?) → Contact[]
```

Um membro é considerado em contato quando sua velocidade entre frames é inferior ao limiar:

```
velocity_i = ||kp[t] - kp[t-1]||₂  <  VELOCITY_THRESHOLD (px/frame)
```

Membros monitorados: `right_hand (9)`, `left_hand (10)`, `right_foot (15)`, `left_foot (16)`.

Apenas contatos detectados entram no cálculo IDW. Membros em movimento são excluídos automaticamente.

---

### 3. Distribuição de forças — IDW

```js
calculateIDW(cog, contacts, bodyWeight) → ForcePoint[]
```

Distribui o peso corporal entre os pontos de contato ativos usando Inverse Distance Weighting:

```
w_i     = 1 / d_i²
F_i     = W × w_i / Σ(w_j)     [Newton]
F_i_kg  = F_i / 9.81            [kg-força]
```

Onde `d_i` é a distância euclidiana em metros do CoG ao ponto `i` (convertida por `PX_TO_METER`).

**Invariante matemático garantido:** `Σ(F_i_kg) = bodyWeight` (exato, independente do número de contatos).

**Validação:** com qualquer configuração de contatos e 70 kg, a soma das forças deve ser `70 ± 2%`.

---

### 4. Torques articulares

```js
calcAngle(A, B, C) → number          // graus [0°, 180°]
calcJointAngles(keypoints) → Object   // mapa articulação → graus
calcTorques(keypoints, bodyWeight) → JointTorque[]
```

**Fórmula do torque:**

```
τ = r × F × |sin(θ)|

r  = comprimento do segmento distal (braço de alavanca, metros)
F  = ratio_segmento × bodyWeight × 9.81   [Newton]
θ  = ângulo de flexão da articulação      [radianos]
```

**Propriedades:**
- `θ = 0°` ou `180°` → `sin = 0` → torque mínimo (articulação reta)
- `θ = 90°` → `sin = 1` → torque máximo (posição mais exigente)

**Exemplo de validação — cotovelo 90° / 70 kg:**
```
F = 0.023 × 70 × 9.81 = 15.8 N
r = 0.27 m
τ = 0.27 × 15.8 × sin(90°) = 4.3 Nm
```

**Articulações monitoradas (bilaterais):**

| Articulação | Keypoints (A → B → C) | Segmento | r (m) |
|-------------|----------------------|----------|-------|
| Cotovelo | ombro → cotovelo → punho | antebraço | 0.27 |
| Ombro | quadril → ombro → cotovelo | braço sup. | 0.32 |
| Quadril | ombro → quadril → joelho | coxa | 0.42 |
| Joelho | quadril → joelho → tornozelo | tíbia | 0.40 |

**Color map:**

| Torque | Cor | Significado |
|--------|-----|-------------|
| < 30 Nm | `#27500A` (verde) | Carga baixa |
| 30–70 Nm | `#BA7517` (âmbar) | Carga moderada |
| ≥ 70 Nm | `#A32D2D` (vermelho) | Carga alta, risco |

---

### 5. Carga dos dedos — Finger Load

```js
calcFingerLoad(handForce_kg, gripType) → FingerLoad[]
```

Distribui a força de uma mão entre os 5 dedos e calcula o risco de ruptura do pulley A2.

**Tipos de pega disponíveis:** `'crimp'`, `'halfcrimp'`, `'open'`, `'pinch'`

**Distribuição de carga (%):**

| Pega | Polegar | Indicador | Médio | Anular | Mínimo |
|------|---------|-----------|-------|--------|--------|
| Full crimp | 10% | **35%** | **32%** | 18% | 5% |
| Half crimp | 12% | 32% | 30% | 20% | 6% |
| Open hand | 15% | 30% | 28% | 20% | 7% |
| Pinch | 35% | 25% | 20% | 13% | 7% |

> No crimp, indicador e médio concentram 67% da carga total — explicação biomecânica para a alta incidência de ruptura do pulley A2 nesses dedos.

**Limites do pulley A2 por dedo:**

| Dedo | Limite (kg) |
|------|-------------|
| Polegar | 8 |
| Indicador | 12 |
| Médio | 11 |
| Anular | 9 |
| Mínimo | 6 |

**Fórmula de risco:**
```
load_dedo_i  = F_mão × weight_i
risk_pct_i   = load_dedo_i / PULLEY_LIMIT_i × 100
```

**Alertas automáticos:**

| Risco | Cor | Status |
|-------|-----|--------|
| < 60% | verde | Seguro |
| 60–85% | âmbar | Atenção |
| ≥ 85% | vermelho | Alerta de lesão |

**Exemplo de validação — crimp / 30 kg:**
```
Indicador: 30 × 0.35 = 10.5 kg → 10.5/12 = 87.5%  → ALERTA
Médio:     30 × 0.32 = 9.6 kg  → 9.6/11  = 87.3%  → ALERTA
```

---

### 6. Score composto (0–100)

```js
calcCompositeScore(forces, torques, fingers, bodyWeight)
  → { total: number, breakdown: { efficiency, symmetry, articular, fingers } }
```

Média ponderada de 4 dimensões biomecânicas:

| Dimensão | Peso | Cálculo |
|----------|------|---------|
| Eficiência de força | 30% | `max(0, 100 − σ(forças)/ideal × 100)` |
| Simetria corporal | 25% | `max(0, 100 − Δombro − Δquadril)` (Nm) |
| Risco articular | 25% | Função linear por partes (ver abaixo) |
| Carga de dedos | 20% | `max(0, 100 − max_risk_pct)` |

**Risco articular — função linear por partes (contínua):**
```
τ_max < 30 Nm  →  100
τ_max < 70 Nm  →  100 − (τ_max − 30) × 1.5        [100 → 40]
τ_max ≥ 70 Nm  →  max(0, 40 − (τ_max − 70))        [40 → 0]
```

**Score total:**
```
SCORE = 0.30 × eficiência + 0.25 × simetria + 0.25 × articular + 0.20 × dedos
```

---

### 7. Calibração pixel → metro

Por padrão, `PX_TO_METER = 0.002` (estimativa para 720p, escalador de corpo inteiro).

Para calibrar com precisão a partir do vídeo:

```js
import { setPxToMeter } from './services/physics.js'

// Exemplo: medir o fêmur do atleta em pixels
// fêmur real = 0.42m, fêmur medido no frame = 210px
const femurPx = 210
setPxToMeter(0.42 / femurPx)  // → 0.002
```

Alternativa: usar a altura total do escalador em pixels vs altura real em metros.

---

## Serviços

### `src/services/anthropic.js`

Integração com a Anthropic Claude Vision API para análise qualitativa de frames.

```js
analyzeClip(file: File) → Promise<{ metrics[], insights[] }>
```

- Extrai o primeiro frame do vídeo como JPEG base64
- Envia ao Claude com prompt especializado em biomecânica de escalada
- Retorna métricas e insights estruturados em português
- **Modelo:** `claude-opus-4-5`
- **Fallback:** em caso de erro de API, usa `MOCK_ANALYSIS` automaticamente

### `src/services/mockData.js`

Dados de desenvolvimento offline:

| Export | Conteúdo |
|--------|----------|
| `MOCK_CLIPS` | 2 vídeos de exemplo com metadados |
| `MOCK_ANALYSIS` | Análise completa com 4 métricas e 3 insights |
| `MOCK_PHYSICS` | Distribuição de forças e trajetória de CoG mock |

### `src/hooks/useAnalysis.js`

Hook React que encapsula o fluxo completo de análise:

```js
const { analysis, loading, error, analyze } = useAnalysis()
```

- `analyze(clip)` — dispara análise real (arquivo) ou carrega mock (sem arquivo)
- Loading state automático durante requisição
- Fallback transparente para mock em caso de erro

---

## Planos e preços

| Plano | Preço | Vídeos | Recursos |
|-------|-------|--------|----------|
| Free | Grátis | 3/mês | Análise básica |
| Individual | R$ 29/mês | Ilimitados | Análise completa + histórico |
| Academia | R$ 149/mês | Ilimitados | 20 alunos + painel do treinador |

---

## Roadmap de sprints

### Sprint 1 — Física e torque
- [ ] Integrar `physics.js` ao `PhysicsTab.jsx`
- [ ] Exibir torques em Nm com color map sobre o skeleton
- [ ] Exibir forças IDW (kg) nas mãos e pés
- [ ] Exibir score composto no topo da AnalysisTab
- [ ] Testes unitários das fórmulas

### Sprint 2 — Finger Load
- [ ] Criar `src/components/analysis/FingerLoad.jsx`
- [ ] Skeleton SVG das mãos com nós coloridos por carga
- [ ] Barras por dedo com alertas automáticos
- [ ] Integrar seleção de grip type no fluxo de análise

### Sprint 3 — Hold Detection + overlay
- [ ] Integrar modelo de detecção de agarres via API
- [ ] Renderizar bounding boxes sobre o canvas do frame
- [ ] Label "Next" para próximo agarre previsto
- [ ] Overlay completo: skeleton + torques + CoG + holds

### Sprint 4 — Exportação
- [ ] Vídeo anotado via MediaRecorder (canvas → MP4)
- [ ] Relatório PDF via jsPDF
- [ ] Histórico de sessões via localStorage

### Sprint 5 — Produto
- [ ] Backend proxy para a API key (Node.js / Edge Function)
- [ ] Autenticação de usuários
- [ ] Painel do treinador (plano Academia)
- [ ] App mobile (React Native)

---

## Referências científicas

| Referência | Uso no projeto |
|-----------|---------------|
| **De Leva, P. (1996).** Adjustments to Zatsiorsky-Seluyanov's segment inertia parameters. *Journal of Biomechanics, 29*(9), 1223–1230. | Razões de massa por segmento corporal (`SEGMENT_RATIOS`) |
| **Chao, E.Y. et al. (1989).** Biomechanics of the Hand. *Journal of Hand Surgery.* | Distribuição de carga por dedo e limites do pulley A2 (`GRIP_WEIGHTS`, `PULLEY_LIMITS_KG`) |

---

## Segurança

> **Atenção:** a chave da API Anthropic nunca deve ser exposta no frontend em produção.

O arquivo `.env` com `VITE_ANTHROPIC_API_KEY` é carregado pelo Vite em build time. Em produção, implemente um backend (Node.js, Edge Function, etc.) para fazer o proxy das requisições antes de publicar.

O arquivo `.env` está no `.gitignore` — nunca faça commit da sua chave real.

---

## Licença

MIT
