const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'R$0',
    cycle: 'para sempre',
    features: ['3 vídeos por mês', 'Análise biomecânica básica', 'Pontuação geral'],
    featured: false,
    cta: 'Plano atual',
  },
  {
    id: 'individual',
    name: 'Individual',
    price: 'R$29',
    cycle: 'por mês · cancela quando quiser',
    features: ['Vídeos ilimitados', 'Análise completa + física', 'Histórico de evolução', 'Análise de respiração', 'Relatório PDF semanal'],
    featured: true,
    cta: 'Assinar Individual',
  },
  {
    id: 'academia',
    name: 'Academia',
    price: 'R$149',
    cycle: 'por mês · até 20 alunos',
    features: ['Tudo do Individual', 'Painel do treinador', 'Comparação entre alunos', 'Suporte prioritário'],
    featured: false,
    cta: 'Assinar Academia',
  },
]

export default function PlansTab() {
  return (
    <div>
      {PLANS.map(plan => (
        <div
          key={plan.id}
          style={{
            border: plan.featured ? '2px solid #639922' : '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 10,
          }}
        >
          {plan.featured && (
            <span style={{
              display: 'inline-block', fontSize: 10,
              background: '#EAF3DE', color: '#3B6D11',
              padding: '2px 8px', borderRadius: 20, fontWeight: 500, marginBottom: 8,
            }}>Mais popular</span>
          )}
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800 }}>{plan.name}</p>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 700, color: plan.featured ? '#639922' : '#888780', margin: '4px 0 2px' }}>
            {plan.price}
          </p>
          <p style={{ fontSize: 12, color: '#888780' }}>{plan.cycle}</p>
          <ul style={{ listStyle: 'none', marginTop: 12 }}>
            {plan.features.map(f => (
              <li key={f} style={{ fontSize: 12, color: '#888780', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ width: 6, height: 6, background: '#639922', borderRadius: '50%', marginTop: 5, flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>
          <button style={{
            width: '100%', marginTop: 12, padding: 10, fontSize: 13,
            fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
            borderRadius: 8,
            border: plan.featured ? 'none' : '0.5px solid rgba(0,0,0,0.2)',
            background: plan.featured ? '#639922' : 'none',
            color: plan.featured ? '#fff' : '#2C2C2A',
            cursor: 'pointer',
          }}>
            {plan.cta}
          </button>
        </div>
      ))}
    </div>
  )
}
