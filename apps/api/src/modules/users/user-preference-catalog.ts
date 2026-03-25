export const USER_PREFERENCE_CATALOG = {
  shifts: [
    { value: 'morning', label: 'Mattina', description: 'Disponibile soprattutto nei turni mattutini', keywords: ['mattina', 'morning'], sortOrder: 10 },
    { value: 'afternoon', label: 'Pomeriggio', description: 'Preferenza per turni pomeridiani', keywords: ['pomeriggio', 'afternoon'], sortOrder: 20 },
    { value: 'evening', label: 'Sera', description: 'Disponibile soprattutto in fascia serale', keywords: ['sera', 'evening'], sortOrder: 30 },
    { value: 'holiday', label: 'Festivi', description: 'Preferenza per giorni festivi riconosciuti', keywords: ['holiday', 'festivi'], sortOrder: 40 },
  ],
  competencies: [
    { value: 'audio', label: 'Audio', description: 'Supporto audio e fonica', keywords: ['audio', 'fonica', 'microfoni'], sortOrder: 10 },
    { value: 'lights', label: 'Luci', description: 'Supporto luci e regia tecnica', keywords: ['luci', 'lighting', 'regia'], sortOrder: 20 },
    { value: 'welcome', label: 'Accoglienza', description: 'Accoglienza persone e infopoint', keywords: ['welcome', 'accoglienza', 'ospitalita'], sortOrder: 30 },
    { value: 'medical', label: 'Primo soccorso', description: 'Competenze sanitarie e primo soccorso', keywords: ['medical', 'soccorso', 'sanitario'], sortOrder: 40 },
    { value: 'logistics', label: 'Logistica', description: 'Movimentazione, setup e supporto logistico', keywords: ['logistica', 'setup', 'magazzino'], sortOrder: 50 },
    { value: 'security', label: 'Sicurezza', description: 'Presidio accessi e sicurezza operativa', keywords: ['sicurezza', 'security', 'accessi'], sortOrder: 60 },
  ],
  locations: [
    { value: 'sede_a', label: 'Sede A', description: 'Sede operativa principale A', keywords: ['sede a', 'location a'], sortOrder: 10 },
    { value: 'sede_b', label: 'Sede B', description: 'Sede operativa principale B', keywords: ['sede b', 'location b'], sortOrder: 20 },
  ],
} as const;
