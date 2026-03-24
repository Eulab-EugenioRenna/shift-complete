# Production Plan per `shift-complete`

## Obiettivo

Portare `shift-complete` dallo stato attuale di baseline architetturale a SaaS production-ready, con una UX sostanzialmente ripensata prendendo come riferimento il linguaggio operativo visibile nello screenshot di Planning Center:

- shell leggera e orientata al lavoro quotidiano
- top bar chiara e persistente
- moduli distinti ma coerenti
- forte densita informativa senza caos
- tabelle e calendario come strumenti operativi, non vetrine
- pannelli laterali e drawer per dettaglio/azioni rapide

Il principio guida e questo: meno demo, piu workspace.

## Stato di partenza

### Gia presente
- Nx monorepo
- Angular PWA
- NestJS API
- Prisma/PostgreSQL
- ruoli base
- primi moduli teams/events/auth/resources/inventory
- audit log iniziale
- documentazione tecnica embrionale

### Non ancora production-ready
- auth incompleta
- CRUD admin incompleti
- dominio scheduling incompleto
- ricorrenze non reali
- availability e replacements assenti
- UI ancora troppo dimostrativa
- realtime/queue/cache non completati
- test e CI insufficienti
- osservabilita non pronta

## Direzione UI target

## Pattern da prendere dal riferimento visuale

### 1. App shell
- top bar persistente con ricerca, filtro globale, quick actions e stato utente
- sidebar snella, modulare, con sezioni poche ma forti
- contenuto centrale ampio, con toolbar locale per ogni modulo

### 2. Workspace per modulo
- ogni modulo deve avere una toolbar locale con:
  - titolo
  - filtri
  - azione primaria
  - toggle vista
- evitare pagine vuote o intro decorative

### 3. Densita informativa controllata
- usare tabelle, summary cards, badges, progress e semafori
- ridurre card giganti e blocchi troppo “hero”
- privilegiare overview + dettaglio contestuale

### 4. Dettaglio contestuale
- usare drawer e side panel per:
  - dettaglio evento
  - assegnazione volontari
  - modifica team
  - visualizzazione persona
- limitare i dialog modali ai casi davvero bloccanti

### 5. Calendario operativo
- vista mese e settimana reali
- filtri sempre presenti
- dettaglio evento laterale
- drag and drop solo dove consentito
- evidenza immediata di copertura, conflitti, slot vacanti

### 6. Dashboard non decorativa
- dashboard diversa per ruolo
- KPI basati su dati reali
- agenda del giorno/settimana
- task e criticita
- notifiche e richieste aperte

## Nuova IA del prodotto

### Navigazione primaria consigliata
- Dashboard
- Pianificazione
- Team
- Persone
- Inventario
- Risorse
- Report
- Impostazioni

### Navigazione secondaria per ruolo

#### Amministratore
- panoramica globale
- utenti
- team
- pianificazione globale
- report
- audit
- impostazioni sistema

#### Leader del servizio
- dashboard servizio
- calendario servizio
- board assegnazioni
- volontari del team
- mansioni
- risorse team

#### Volontario
- miei turni
- disponibilita
- notifiche
- documenti
- profilo

## Stream di delivery

## Stream A: Platform e security

### Obiettivi
- rendere sicuri accesso, configurazione e tracciamento

### Task
- introdurre refresh token e revoca sessioni
- implementare password reset e verify email
- rate limiting su login/register
- session table e audit login
- centralizzare config env web/api
- structured logging con correlation id
- error shape coerente per API

### Deliverable
- auth production-grade
- env strategy chiara
- logging leggibile
- failure handling tracciabile

## Stream B: Dominio core

### Obiettivi
- completare il dominio vero del SaaS

### Task
- introdurre `Duty`
- introdurre `Availability`
- introdurre `Replacement`
- introdurre `OnboardingState` completo
- introdurre `UserSettings`, `DashboardPreference`, `AISettings`
- estendere `Team`, `Event`, `Assignment`
- supportare colori/icone per team, eventi, mansioni
- materializzare ricorrenze ed eccezioni

### Deliverable
- schema Prisma evoluto
- CRUD completi e coerenti
- regole di business centralizzate

## Stream C: Scheduling e collaboration

### Obiettivi
- trasformare la pianificazione in un flusso operativo reale

### Task
- scheduling engine con fairness, availability, overlap, rest window
- preview spiegata e applicazione selettiva
- conferma/rifiuto turni
- richieste sostituzione
- gap alerts
- websocket scoped per team/eventi
- worker BullMQ per notifiche, export, ricorrenze e scheduling jobs

### Deliverable
- pianificazione affidabile
- feedback realtime utile
- automazione non bloccante

## Stream D: UI redesign

### Obiettivi
- riprogettare l’esperienza operativa con un linguaggio vicino al riferimento Planning Center, ma senza copiarlo

### Task
- nuova shell applicativa
- nuovi token visuali
- nuova dashboard
- nuovo calendario
- nuova board assegnazioni
- pagina team e pagina persone
- pagina volontario
- drawer e panel system
- tooltip/help system
- dark mode coerente

### Deliverable
- UI piu densa, leggibile, modulare, scalabile

## Stream E: Production ops e quality

### Obiettivi
- rendere il prodotto distribuibile e mantenibile

### Task
- test integration backend
- E2E sui journey principali
- CI con lint/build/test/migrations checks
- Docker hardening
- healthcheck e readiness
- monitoring, alerting, error tracking
- backup/restore strategy Postgres
- seed ambienti dev/staging

### Deliverable
- pipeline di rilascio affidabile
- riduzione rischio regressioni

## Roadmap per milestone

## Milestone 1: Core secure foundation

### Scope
- auth hardening
- admin users CRUD
- capability map
- typed API client
- logging/error model

### Output atteso
- piattaforma governabile
- backlog tecnico ridotto

## Milestone 2: Domain completion

### Scope
- duties
- availability
- replacements
- team settings
- event aggregate corretto
- ricorrenze reali

### Output atteso
- dominio principale completo

## Milestone 3: UI overhaul v1

### Scope
- app shell nuova
- dashboard nuove
- calendario reale
- event details drawer
- assignment board
- team workspace

### Output atteso
- prodotto gia usabile in modo credibile

## Milestone 4: Automation and async operations

### Scope
- worker
- notifiche asincrone
- export jobs
- websocket scoped
- scheduling engine v2

### Output atteso
- operativita avanzata

## Milestone 5: Production readiness

### Scope
- E2E
- CI/CD
- monitoring
- staging hardening
- release checklist

### Output atteso
- go-live controllato

## Priorita UI: cosa rifare subito

## 1. App shell
- sostituire l’attuale shell con:
  - sidebar fissa a sinistra
  - top bar con ricerca e quick actions
  - area contenuto a larghezza piena
  - toolbar locale in ogni pagina

## 2. Dashboard
- eliminare KPI hardcoded
- introdurre layout a blocchi:
  - oggi
  - turni da confermare
  - slot scoperti
  - notifiche
  - stato inventario
  - attivita recenti

## 3. Pianificazione
- sostituire la griglia semplificata con:
  - month view reale
  - week view reale
  - schedule board per assegnazioni
  - drawer dettaglio evento
  - slot coverage indicators

## 4. Team workspace
- pagina team con tabs:
  - overview
  - volontari
  - mansioni
  - eventi
  - inventario
  - risorse

## 5. People / utenti
- nuova pagina persone per Amministratore e Leader
- tabella densa, filtri, stato onboarding, ruolo, disponibilita
- drawer profilo persona

## 6. Volunteer home
- focus su:
  - prossimi turni
  - richieste aperte
  - disponibilita
  - documenti rilevanti

## Regole di design

### Da fare
- typography sobria ma non generica
- fondo chiaro/scuro con profondita viva, costruito con gradienti ambientali coerenti col brand
- movimento di sfondo molto lento e organico, tipo lava soft o parallasse leggera, mai invasivo
- accento cromatico deciso ma controllato
- bordi sottili e componenti compatti
- icone funzionali
- densita desktop alta, mobile semplificato
- superfici glass o overlay traslucidi solo dove aiutano la gerarchia visiva

### Background e motion
- lo sfondo applicativo deve vivere a livello globale, non come texture isolata di singole pagine
- usare 2-3 masse sfumate con blur ampio e colori derivati dagli accenti prodotto e dai neutri del tema
- aggiungere solo se utile una grana molto sottile o texture soft-light per evitare fondi troppo digitali o piatti
- light theme: atmosfera ariosa, blu polverosi e bianchi freddi; dark theme: profondita blu notte, senza nero piatto
- le animazioni devono essere lente, continue e quasi impercettibili; lo scroll puo spostare leggermente i layer per un effetto di profondita
- quando serve piu fluidita, usare GSAP per interpolare il movimento ambientale e evitare scatti da aggiornamenti diretti su scroll
- rispettare `prefers-reduced-motion` disattivando le animazioni non essenziali

### Da evitare
- hero sections da marketing
- card troppo grandi e decorative
- dialog ovunque
- pagine vuote con poco contenuto
- dashboard “finte” con numeri fissi

## Sequenza di implementazione consigliata

### Step 1
- evolvere schema dati e auth

### Step 2
- introdurre typed contracts e servizi frontend tipizzati

### Step 3
- rifare shell, dashboard e navigazione

### Step 4
- rifare pianificazione e calendario

### Step 5
- introdurre people/team workspaces

### Step 6
- completare realtime, jobs, export, monitoring

## Criteri di done per go-live

- nessuna feature critica dipende da mock o dati hardcoded
- auth, ruoli e scope dati sono verificati da test
- calendario e assegnazioni funzionano con dati reali
- notifiche ed export passano da job asincroni
- audit log copre tutte le mutazioni critiche
- dashboard mostra dati reali per ruolo
- staging e produzione hanno pipeline verificata
- esistono backup, healthcheck, alert e rollback plan

## Prossimo passo operativo

Il primo cantiere corretto e:

1. evoluzione schema e dominio auth/users/duties/availability/replacements
2. refactor servizi frontend con contratti tipizzati
3. redesign della shell e della dashboard
4. redesign del calendario come modulo guida del prodotto

Se si vuole massimizzare il risultato in poco tempo, il primo sprint deve chiudere backend foundation + nuova shell UI, non micro-fix distribuiti.
