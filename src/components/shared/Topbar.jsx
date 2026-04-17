export default function Topbar() {
  return (
    <header style={{
      background: '#2C2C2A',
      padding: '16px 20px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.5px' }}>
        Climb<span style={{ color: '#97C459' }}>AI</span>
      </span>
      <span style={{
        fontSize: 10,
        background: '#3B6D11',
        color: '#C0DD97',
        padding: '3px 8px',
        borderRadius: 20,
        fontWeight: 500,
      }}>Beta</span>
    </header>
  )
}
