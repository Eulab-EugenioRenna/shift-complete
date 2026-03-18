Agisci come Software Architect, Senior Full Stack Engineer, UX Engineer, DevOps Engineer e Code Reviewer specializzato in SaaS enterprise modulari.

Contesto:
Ho due cartelle sorgente che contengono due demo di un SaaS in via di sviluppo:

1. `pdg_shift`

- quasi completo
- logiche già presenti ma con interazioni farraginose
- UI da rivedere
- UX poco fluida
- possibile base funzionale da salvare e rifattorizzare

2. `shift-manager`

- iniziato e poi abbandonato
- stack differente
- può contenere idee, moduli o pattern riutilizzabili

Obiettivo:
Analizza entrambi i progetti esistenti in profondità e progetta/definisci un nuovo SaaS chiamato `shift-complete`, da creare in una nuova cartella separata, senza sporcare i sorgenti originali, recuperando il meglio delle due demo ma rifattorizzando struttura, logica, UX e architettura.

Stack target obbligatorio:

- Nx monorepo
- Angular PWA
- Tailwind CSS
- PrimeNG come libreria componenti
- librerie condivise
- NestJS backend
- PostgreSQL
- Redis per cache e queue
- websocket per realtime e collaborazione
- logging strutturato
- notifiche
- supporto Docker
- dark mode
- AI agnostic con settings dedicati
- export dati
- documentazione dev
- documentazione user
- onboarding per utente iscritto

Dominio applicativo:
Il SaaS gestisce turni, eventi, team, mansioni, inventario, strumenti, risorse/documenti e assegnazioni utenti.

Terminologia obbligatoria:

- NON usare “superuser”
- chiamare il ruolo massimo “Amministratore”

Regole di accesso e ruoli:

- registrazione utenti
- autenticazione/login
- accesso role-based
- Amministratore con permessi completi
- l’Amministratore crea i team
- l’Amministratore nomina un Leader del servizio
- il Leader del servizio assegna i ruoli negli eventi
- gli eventi possono essere unici o ricorrenti
- va mantenuto lo storico
- il volontario vede solo i propri turni
- il Leader vede solo gli eventi del proprio servizio/team/ambito autorizzato
- l’Amministratore vede tutto

Viste richieste:

- dashboard completa con KPI, grafici, indicatori, semafori, stato operativo
- calendario con vista mensile e settimanale
- drag and drop nel calendario se permesso dal ruolo
- UI moderna, coerente, funzionale, accessibile
- modali/dialog custom
- tooltip descrittivi per migliorare la comprensione della UI

Richiesta principale:
Esegui una ANALISI COMPLETA del codice esistente e proponi un piano di miglioramento e ricostruzione. Devi analizzare e migliorare ogni funzione già presente o potenzialmente recuperabile.

Funzioni desiderate da verificare, progettare o completare:

- auth
- register
- signin
- crud utenti da parte dell’Amministratore
- UI role-based
- UX flow
- calendar view
- calendar drag and drop eventi
- crud eventi
- crud risorse / file manager
- assegnazione utenti ai ruoli negli eventi da parte del Leader
- crud team da parte dell’Amministratore
- crud mansioni nel team (Amministratore e Leader)
- validazione frontend/backend
- toast, log e gestione errori/stati
- algoritmo automatico turni
- checklist websocket, redis, queue, cache
- dashboard usabile, descrittiva, con semafori, per tipologia utente
- tooltip descrittivi UI
- icone e colori personalizzabili per eventi, team, persone e ruoli

Se individui altri obiettivi necessari dal contesto, aggiungili autonomamente e motivali.

Istruzioni operative:
Voglio un’analisi strutturata, severa, concreta, da tech lead. Non limitarti a descrivere: confronta, valuta, evidenzia lacune, rischi, codice riusabile, codice da scartare, e definisci come trasformare le demo nel nuovo prodotto `shift-complete`.

Output richiesto — struttura obbligatoria:

1. Executive summary

- Spiega in modo sintetico:
  - cosa è recuperabile da `pdg_shift`
  - cosa è recuperabile da `shift-manager`
  - cosa va riscritto da zero
  - quali sono i principali rischi tecnici e UX
  - qual è la strategia consigliata per creare `shift-complete`

2. Analisi comparativa dei due progetti
   Per ciascun progetto analizza:

- stack tecnologico
- struttura cartelle
- qualità architetturale
- qualità del codice
- separazione responsabilità
- coerenza naming
- gestione stato
- routing
- gestione auth
- gestione ruoli
- componentizzazione UI
- accessibilità
- performance
- error handling
- logging
- test
- riusabilità
- debito tecnico
- dipendenze obsolete o rischiose
- sicurezza
- qualità UX

Concludi con:

- cosa tenere
- cosa adattare
- cosa eliminare
- priorità alta/media/bassa

3. Gap analysis rispetto al prodotto target `shift-complete`
   Costruisci una matrice:

- funzionalità richiesta
- presente in `pdg_shift`? (si/parziale/no)
- presente in `shift-manager`? (si/parziale/no)
- riusabile? (si/no/parziale)
- criticità
- proposta implementativa
- priorità
- effort stimato (S/M/L/XL)

4. Architettura target consigliata
   Definisci l’architettura ideale del nuovo progetto:

- struttura Nx monorepo
- app Angular
- app NestJS
- libs condivise
- domain libs
- ui libs
- data-access libs
- util libs
- auth libs
- api contract / dto / validation
- real-time libs
- logging libs
- notification libs
- storage/file manager libs
- scheduling/algorithm libs

Fornisci una proposta concreta di naming cartelle e librerie.

5. Dominio e modello dati
   Definisci il modello concettuale e logico con entità, relazioni e responsabilità.
   Entità minime da considerare:

- User
- Role
- Permission
- Team
- ServiceLeader / leadership assignment
- Event
- EventRecurrence
- ShiftAssignment
- Duty / Mansione
- VolunteerProfile
- InventoryItem
- Tool / Equipment
- ResourceFile / Folder
- Notification
- AuditLog
- UserSettings
- AISettings
- DashboardPreference
- OnboardingState
- Availability / indisponibilità
- Replacement / sostituzione
- ExportJob
- QueueJob

Per ogni entità specifica:

- scopo
- attributi principali
- relazioni
- vincoli
- audit/storico richiesto
- soft delete si/no
- campi colore/icona se utili

6. Matrice ruoli e permessi
   Definisci chiaramente:

- Amministratore
- Leader del servizio
- Volontario
- eventuali ruoli aggiuntivi se necessari

Per ogni ruolo elenca:

- cosa vede
- cosa crea
- cosa modifica
- cosa elimina
- cosa approva
- cosa esporta
- cosa può trascinare nel calendario
- cosa può assegnare
- cosa può vedere in dashboard
- limiti e scope dati

7. Analisi funzione per funzione
   Analizza e migliora ogni funzione trovata o da introdurre.
   Per ogni funzione/area usa questo schema:

- Stato attuale nei progetti esistenti
- Problemi riscontrati
- Rischi
- Refactor consigliato
- UX improvement
- Validazioni richieste
- Sicurezza
- Logging / audit
- Test da fare
- Priorità

Aree obbligatorie:

- auth
- register
- signin
- reset password / change password / session handling
- crud utenti
- crud team
- crud mansioni
- crud eventi
- eventi ricorrenti
- assegnazioni turno
- sostituzioni
- calendario
- drag and drop calendario
- dashboard per ruolo
- file manager / risorse
- inventario e strumenti
- notifiche
- websocket realtime
- cache redis
- queue background jobs
- export
- onboarding
- impostazioni utente
- dark mode
- AI settings agnostic
- tooltip e help UI
- log e audit trail
- error state e toast
- ricerca e filtri
- storico modifiche

8. UX/UI review approfondita
   Valuta la UX esistente e proponi una UI moderna e funzionale.
   Analizza:

- flussi lenti o confusi
- click inutili
- modali/dialog sbagliati
- gerarchia visiva
- feedback utente
- densità informativa
- usabilità mobile/tablet/desktop
- accessibilità
- coerenza di colori e icone
- leggibilità degli stati
- empty states
- loading states
- error states
- semafori e indicatori operativi
- tooltip contestuali

Poi proponi:

- linee guida UI
- linee guida UX
- componenti PrimeNG consigliati
- uso di Tailwind
- dashboard layout
- calendario layout
- pattern per drawer/modali
- best practice per dark mode
- convenzione colori per team/eventi/ruoli/persone
- sistema icone personalizzabile

9. Dashboard target
   Progetta dashboard differenti per ruolo:

- Amministratore
- Leader del servizio
- Volontario

Per ciascuna dashboard definisci:

- KPI
- widget
- grafici
- semafori
- alert
- task rapide
- viste elenco
- filtri
- indicatori rischio/copertura turni
- eventi imminenti
- stato inventario/strumenti
- stato documenti/risorse
- notifiche realtime

10. Calendario target
    Definisci in dettaglio:

- vista mensile
- vista settimanale
- opzionale vista giornaliera se utile
- colori evento/team/ruolo/persona
- drag and drop role-based
- editing rapido
- dettagli evento
- ricorrenza
- conflitti
- disponibilità utenti
- assegnazioni incomplete
- semafori copertura turno
- filtri multipli
- legenda
- tooltip
- audit modifiche

11. Algoritmo automatico turni
    Progetta l’algoritmo per assegnazione automatica e sostituzioni.
    Deve supportare almeno:

- regole configurabili
- fairness / rotazione equilibrata
- priorità per ruolo/mansione
- disponibilità utente
- esclusioni
- limite massimo turni per periodo
- incompatibilità
- storico carico turni
- sostituzioni automatiche/manuali
- simulazione prima del salvataggio
- spiegazione del motivo dell’assegnazione
- override del Leader o Amministratore
- setting attivabili/disattivabili

Richiedo:

- logica proposta
- input/output
- pseudocodice
- edge cases
- audit trail
- strategia test

12. Websocket / Redis / Queue / Cache checklist
    Crea una checklist pratica per verificare:

- websocket realtime
- collaborazione concorrente
- redis cache
- redis queue
- invalidazione cache
- eventi realtime per calendario/dashboard/notifiche
- job asincroni per export/notifiche/elaborazioni
- resilienza
- retry
- dead letter strategy se utile
- osservabilità

13. Sicurezza
    Analizza e proponi:

- RBAC
- protezione route e API
- validazione input
- sanitizzazione
- rate limit
- sicurezza file upload
- sicurezza websocket
- gestione token/sessione
- audit log
- segregazione dati per ruolo
- secure defaults
- segreti e configurazione env
- docker security basics

14. Validazione frontend/backend
    Definisci strategia completa:

- validazione form Angular
- validazione DTO NestJS
- error mapping backend -> UI
- messaggi chiari
- gestione errori globali
- casi limite
- consistenza dati
- validazioni di business

15. Logging, osservabilità e audit
    Definisci:

- cosa loggare
- livelli log
- log tecnici vs audit log
- eventi critici
- correlazione richieste
- error tracking
- azioni sensibili da auditare
- modifiche assegnazioni/eventi/team/ruoli
- login/logout/fallimenti auth

16. Docker e ambienti
    Proponi setup minimo:

- docker per frontend
- docker per backend
- docker per postgres
- docker per redis
- docker compose
- env example
- dev/prod note
- volumi
- migrazioni
- seed iniziale

17. Seed iniziale obbligatorio
    Prevedi la creazione automatica di:

- ruolo Amministratore
- account Amministratore iniziale
- permessi completi
- dati minimi necessari per primo avvio
  Descrivi come farlo in sicurezza.

18. Piano di implementazione
    Fornisci una roadmap concreta per creare `shift-complete`:

- Fase 0: analisi e recupero
- Fase 1: bootstrap monorepo
- Fase 2: auth + ruoli
- Fase 3: team + mansioni + utenti
- Fase 4: eventi + calendario
- Fase 5: assegnazioni e algoritmo
- Fase 6: dashboard
- Fase 7: inventory + file manager
- Fase 8: realtime + redis + queue
- Fase 9: onboarding + export + documentazione
- Fase 10: hardening + test + docker

Per ogni fase specifica:

- obiettivi
- deliverable
- dipendenze
- rischi
- definition of done

19. Refactor plan del codice esistente
    Indica chiaramente:

- quali file/moduli recuperare quasi invariati
- quali rifattorizzare
- quali tradurre da uno stack all’altro
- quali scartare
- come migrare logiche utili senza importare debito tecnico
- quali anti-pattern evitare

20. Testing strategy
    Definisci:

- unit test
- integration test
- e2e test
- test auth
- test ruoli e permessi
- test calendario
- test drag and drop
- test algoritmo turni
- test websocket
- test export
- test accessibilità
- test UX critici

21. Documentazione
    Definisci struttura per:

- documentazione developer
- documentazione utente
- guida onboarding
- guida ruoli
- guida calendario
- guida assegnazioni
- guida gestione inventario/risorse
- FAQ
- troubleshooting

22. Deliverable finale obbligatorio
    Concludi con:
    A. lista prioritaria dei problemi più gravi trovati
    B. lista delle funzionalità già riusabili
    C. lista delle funzionalità da riscrivere
    D. proposta finale di struttura Nx monorepo
    E. MVP consigliato
    F. backlog post-MVP
    G. quick wins ad alto impatto
    H. rischi aperti
    I. suggerimenti aggiuntivi dedotti dal contesto

Vincoli di risposta:

- rispondi in italiano
- sii molto concreto e tecnico
- non essere generico
- non limitarti a “consigliare”: prendi posizione
- se mancano elementi nei progetti, dichiaralo esplicitamente
- se trovi conflitti architetturali tra i due stack, spiega come risolverli
- se una funzione è assente ma chiaramente necessaria, aggiungila autonomamente
- evidenzia sempre priorità, effort, rischio e benefici
- quando utile, usa tabelle e checklist
- quando utile, proponi naming, struttura cartelle, pattern e convenzioni
- mantieni come nome del prodotto finale: `shift-complete`
- usa sempre il termine “Amministratore” per il ruolo massimo

Obiettivo finale:
Produrre una base di analisi e miglioramento talmente chiara da poter essere usata subito come blueprint tecnico e operativo per ricostruire il prodotto in una nuova cartella `shift-complete`, prendendo il meglio dei due progetti esistenti ma correggendone limiti, UX, architettura e debito tecnico.
