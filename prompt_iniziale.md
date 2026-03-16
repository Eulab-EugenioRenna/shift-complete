hai due cartelle che contengono due demo di un saas in via di sviluppo: pdg_shift quasi completo ma interazioni farraginose e ui da rivedere, shift-manager iniziato e
poi abbandonato. usano due stack differenti. voglio creare un saas prendendo spunto da questi con queste caratteristiche: nx monorepo, angular pwa, tailwind, primeng
component, lib condivise, nestjs backend, postgressql, redis cache e queque, log e notifiche, supporto docker crea tutto su una nuova cartella, shift-complete. il saas permette la
registrazione di utenti e l'accesso in base ai ruoli, crea un account superuser con i premessi totali. il super user crea i team e nomina un leader del servizio. il
leader del servizio potra assegnare i ruoli per ogni evento. gli eventi sono unici o ricorrenti. conserva storico. ogni utente volontario vede solo i suoi turni, il
leader solo gli eventi con il servizio e il superuser tutto. la visulizzazione sarà sia in una dashboard completa (con vari kpi e grafici) che in una sezione calendario
con visione mensile, settimanale e con drag and drop se i permessi dell'utente lo permettono. gestione di inventario e strumenti per team, risorse (filemanager), ai
agnostic con settings, darkmode, ui moderna e ux funzionale, modal e dialog custom, dashboard, logging, export, websocket per realtime e collab. Documentazione dev e
documentazione per utenti. prevedi onboarding per utente iscritto. turni automatici algoritmo per ciclo completo turni e sostituzioni, pemetti setting per auto. il
super user chiamalo amministratore.
