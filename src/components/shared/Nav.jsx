const LABELS = {
  upload: 'Upload',
  analysis: 'Análise',
  physics: 'Física',
  plans: 'Planos',
}

export default function Nav({ activeTab, setActiveTab, tabs }) {
  return (
    <nav style={{
      display: 'flex',
      background: '#F1EFE8',
      borderBottom: '0.5px solid rgba(0,0,0,0.12)',
    }}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            flex: 1,
            padding: '10px 4px',
            fontSize: 11,
            fontFamily: 'DM Sans, sans-serif',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === tab ? '2px solid #639922' : '2px solid transparent',
            color: activeTab === tab ? '#639922' : '#888780',
            fontWeight: activeTab === tab ? 500 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {LABELS[tab]}
        </button>
      ))}
    </nav>
  )
}
