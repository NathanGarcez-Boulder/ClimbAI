import { useState } from 'react'
import Topbar from './components/shared/Topbar.jsx'
import Nav from './components/shared/Nav.jsx'
import UploadTab from './components/upload/UploadTab.jsx'
import AnalysisTab from './components/analysis/AnalysisTab.jsx'
import PhysicsTab from './components/physics/PhysicsTab.jsx'
import PlansTab from './components/plans/PlansTab.jsx'

const TABS = ['upload', 'analysis', 'physics', 'plans']

export default function App() {
  const [activeTab, setActiveTab] = useState('upload')
  const [selectedClip, setSelectedClip] = useState(null)

  const handleClipSelect = (clip) => {
    setSelectedClip(clip)
    setActiveTab('analysis')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Topbar />
      <Nav activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
      <main style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {activeTab === 'upload'   && <UploadTab onClipSelect={handleClipSelect} />}
        {activeTab === 'analysis' && <AnalysisTab clip={selectedClip} />}
        {activeTab === 'physics'  && <PhysicsTab clip={selectedClip} />}
        {activeTab === 'plans'    && <PlansTab />}
      </main>
    </div>
  )
}
