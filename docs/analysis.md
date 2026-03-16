# Analisi completa delle demo e valutazione di `shift-complete`

## 1. Executive summary

### Cosa e recuperabile da `pdg_shift`
- Dominio gia ricco: dashboard, schedule, settings, notifiche, disponibilita, AI helpers, onboarding implicito.
- Ampiezza funzionale vicina al prodotto target: la demo ha gia una narrativa SaaS credibile.
- Dialog, card operative e alcune convenzioni UX sono utili come reference di prodotto, non come codice da portare.

### Cosa e recuperabile da `shift-manager`
- Stack frontend piu vicino al target: Angular standalone, PWA, PrimeNG, Tailwind.
- Prime idee su calendario, auth, team, tooltip e componentizzazione Angular.
- Alcuni pattern di pagina e layout possono essere recuperati come prototipo visuale.

### Cosa va riscritto da zero
- Backend, persistenza, audit, RBAC forte, storico affidabile, queue, cache, realtime e file storage.
- Tutto il modello dati per ricorrenze, sostituzioni, disponibilita, mansioni e permessi granulari.
- I workflow UX piu critici: auth, assegnazioni, calendario, dashboard per ruolo, onboarding.
- Qualsiasi logica che oggi vive in mock, PocketBase o accoppiamenti frontend/backend impliciti.

### Principali rischi tecnici e UX
- `pdg_shift` e funzionalmente ricco ma architetturalmente inadatto al target enterprise richiesto.
- `shift-manager` usa Angular ma resta poco piu che un prototipo con mock data e servizi sottili.
- `shift-complete` esiste gia come baseline tecnica valida, ma oggi e ancora un foundation project, non un SaaS completo.
- Rischio maggiore: scambiare la presenza di pagine e moduli per completezza funzionale. Molte aree in `shift-complete` sono ancora placeholder o MVP tecnico.

### Strategia consigliata
- Confermare `shift-complete` come unica base da far evolvere.
- Trattare `pdg_shift` come reference di dominio e ampiezza funzionale.
- Trattok in are `shift-manager` come reference di ergonomia Angular/PrimeNG, non come base logica.
- Proseguire con roadmap a tranche: hardening backend e modello dati, poi workflow CRUD reali, poi scheduling/realtime/file manager avanzato.

### Giudizio sintetico su `shift-complete`
- Decisione corretta di architettura.
- Buona impostazione Nx + Angular + NestJS + Prisma.
- Stato reale: baseline forte ma incompleta, circa "MVP architetturale con alcune feature dimostrative", non ancora prodotto enterprise pronto.

## 2. Analisi comparativa dei due progetti sorgente

### `pdg_shift`

#### Stack tecnologico
- Next.js 15 + React 18.
- Tailwind CSS.
- PocketBase come backend/auth/store.
- Componenti Radix/shadcn-style.
- Presenza di AI helper con Genkit.

#### Struttura cartelle
- Struttura frontend moderna, leggibile, ma fortemente centrata sulla demo web.
- Dominio sparso tra `app`, `components`, `contexts`, `hooks`, `lib`.
- Mancanza di confini chiari tra application layer, domain layer e infrastructure.

#### Qualita architetturale
- Buona composizione UI.
- Architettura debole per un SaaS multi-modulo con audit forte.
- Backend sostanzialmente delegato a PocketBase e funzioni applicative leggere.

#### Qualita del codice
- Frontend ricco e leggibile in diversi punti.
- Molta logica applicativa nel client.
- Tipizzazione disomogenea, con parti ancora permissive (`any`) e dipendenza da shape PocketBase.

#### Separazione responsabilita
- Parziale.
- Auth, state, notifiche e dominio si intrecciano nel frontend.

#### Naming
- Nel complesso comprensibile.
- Alcuni naming sono guidati dal contesto demo e non da bounded contexts stabili.

#### Gestione stato
- Context + hook custom.
- Adeguata per demo, fragile per crescita enterprise.

#### Routing
- Buono lato UX.
- Non risolve di per se scope dati, ruoli e policy.

#### Auth e ruoli
- Presenti, ma strettamente legati a PocketBase.
- Non abbastanza robusti per permessi granulari per team/evento.

#### UI componentization
- E l’area piu forte del progetto.
- Buona base visuale e ampia copertura di componenti.

#### Accessibilita
- Alcuni componenti aiutano, ma non emerge un piano sistematico di a11y.

#### Performance
- Accettabile per demo.
- Rischio di overfetch e rendering client-heavy.

#### Error handling
- Presente soprattutto tramite toast.
- Mancano osservabilita e failure model seri.

#### Logging
- Quasi assente come capability strutturata.

#### Test
- Non emerge una strategia test significativa.

#### Riusabilita
- Alta a livello di idee di prodotto.
- Bassa a livello di codice portabile nel nuovo stack.

#### Debito tecnico
- Medio-alto.
- Il valore e nel dominio espresso, non nell’impianto architetturale.

#### Dipendenze obsolete o rischiose
- Nessun segnale critico di obsolescenza immediata.
- Il rischio vero e l’adozione di un backend non allineato al target finale.

#### Sicurezza
- Demandata in gran parte a PocketBase.
- Mancano evidenze di audit, policy per scope dati e hardening applicativo.

#### Qualita UX
- Ricca ma dispersiva.
- Interazioni spesso lunghe, dialog-driven, con attrito cognitivo.

#### Conclusione `pdg_shift`
- Cosa tenere: dominio, breadth funzionale, pattern visuali efficaci, tassonomia delle feature.
- Cosa adattare: dashboard, settings, disponibilita, notifiche, flussi di assegnazione.
- Cosa eliminare: dipendenza da PocketBase, accoppiamenti frontend/backend, AI demo non governata.
- Priorita: alta come reference funzionale, bassa come sorgente di codice.

### `shift-manager`

#### Stack tecnologico
- Angular 19 standalone.
- PrimeNG 19 + Tailwind.
- PocketBase.
- PWA configurata.

#### Struttura cartelle
- Semplice e piu leggibile del necessario per un progetto piccolo.
- Dominio compresso in `components`, `services`, `models`, `guards`.

#### Qualita architetturale
- Migliore allineamento frontend rispetto al target.
- Profondita funzionale molto bassa.
- Mancano backend reale, shared libs, domini articolati e persistenza forte.

#### Qualita del codice
- Ordinato in molte aree, ma ancora dimostrativo.
- Diversi componenti usano mock data estesi.
- Alcuni servizi espongono operazioni dirette verso PocketBase senza layer intermedio robusto.

#### Separazione responsabilita
- Meglio di `pdg_shift` sul lato Angular.
- Ancora debole sul confine dominio/infrastruttura.

#### Naming
- In genere chiaro.
- Alcuni modelli sono troppo generici per il dominio reale.

#### Gestione stato
- Locale ai componenti.
- Nessun pattern strutturato per stati condivisi complessi.

#### Routing
- Minimo ma coerente.

#### Auth e ruoli
- Semplici, con persistenza locale del profilo e forte dipendenza da PocketBase.
- Non adatti a RBAC enterprise.

#### UI componentization
- Adeguata per MVP UI.
- Inferiore a `pdg_shift` come ampiezza.

#### Accessibilita
- Non emerge una strategia esplicita.

#### Performance
- Non critica oggi, ma anche poco significativa vista la bassa complessita.

#### Error handling
- Limitato.

#### Logging
- Assente lato prodotto.

#### Test
- Presenti spec file Angular, ma il valore reale dipende dall’implementazione; non emerge una copertura credibile del dominio.

#### Riusabilita
- Media su componenti Angular/PrimeNG.
- Bassa su modello dati e logica.

#### Debito tecnico
- Medio.
- Non tanto per complessita, quanto per incompiutezza.

#### Dipendenze obsolete o rischiose
- Presenza di `@angular/http` e un indicatore negativo: dipendenza legacy non coerente con Angular moderno.
- Accoppiamento con PocketBase ancora non desiderabile.

#### Sicurezza
- Limitata al minimo necessario per una demo.

#### Qualita UX
- Piu semplice, ma anche piu povera.
- Il calendario e i team risultano piu vicini a mock avanzati che a workflow di produzione.

#### Conclusione `shift-manager`
- Cosa tenere: stack frontend, PWA, PrimeNG, alcune impostazioni Angular standalone.
- Cosa adattare: pattern di pagina, alcuni controlli form, calendario come reference UI.
- Cosa eliminare: mock domain, auth povera, modelli troppo semplici.
- Priorita: media come reference tecnica frontend, bassa come base prodotto.

## 3. Gap analysis rispetto al prodotto target `shift-complete`

| Funzionalita richiesta | `pdg_shift` | `shift-manager` | Stato `shift-complete` | Riusabile | Criticita | Proposta implementativa | Priorita | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Registrazione utenti | si | si | si, minimale | parziale | mancano validazioni avanzate, verify email, anti-duplica robusta | DTO + validation + email verification + throttling | alta | M |
| Login e sessione | si | si | si | parziale | manca refresh token, session policy, revoke | introdurre access/refresh token e session audit | alta | M |
| CRUD utenti admin | parziale | no | parziale | no | `users` solo list/me, non c'e admin CRUD pieno | modulo admin-users con scope, filtri, attivazione/disattivazione | alta | M |
| UI role-based | si | parziale | parziale | parziale | ruolo presente ma non tutte le viste sono filtrate in UI | route capability map + nav per ruolo + hidden actions | alta | M |
| Dashboard per ruolo | si | no | parziale | parziale | KPI hardcoded, non guidati da query reali | query aggregate backend + widgets configurabili | alta | M |
| Calendario mensile | si | si | si, basilare | parziale | griglia statica 35 giorni, non e calendario reale | introdurre calendar engine vero + range navigation | alta | M |
| Calendario settimanale | parziale | parziale | no reale | no | select view senza layout dedicato | componente week view dedicato | alta | M |
| Drag and drop calendario | parziale | no | parziale | no | esiste solo board assegnazioni, non spostamento evento | integrare DnD per slot/eventi con policy RBAC | alta | L |
| CRUD eventi | si | parziale | si, MVP | parziale | update incompleto sugli slot, no gestione ricorrenza materiale | aggregate event + slot upsert + recurrence engine | alta | L |
| Eventi ricorrenti | parziale | no | parziale | no | solo `recurrenceRule` a schema, nessuna materializzazione | entita recurrence + generator job + eccezioni | alta | L |
| Storico eventi | parziale | no | parziale | no | `historicalSnapshot` non usato davvero | audit/event versioning | alta | L |
| Assegnazione ruoli negli eventi | si | si mock | si | parziale | manca concetto di duty/skill/approval | separare slot, duty, assignment, confirmation | alta | M |
| CRUD team | si | si | si, MVP | parziale | membership e leader presenti ma dominio ancora ridotto | ampliare team scope, stati, settings, duty catalog | alta | M |
| CRUD mansioni | parziale | parziale | no | no | `roleName` stringa libera, nessuna entita `Duty` | introdurre catalogo mansioni per team | alta | M |
| Disponibilita/indisponibilita | si | no | no | parziale | manca nel modello dati | entita Availability + conflict engine | alta | M |
| Sostituzioni | parziale | no | no | no | non c'e dominio replacement | modulo replacement workflow + audit | alta | M |
| Inventario e strumenti | parziale | no | parziale | parziale | `InventoryItem` troppo semplice, nessuna manutenzione vera | item, tool, maintenance log, check-out | media | M |
| File manager/risorse | parziale | no | parziale | parziale | niente upload, versioning, cartelle reali | storage abstraction + folder tree + ACL | media | L |
| Notifiche | si | parziale | parziale | parziale | canali e delivery ancora base | queue notifiche + preferenze utente | media | M |
| Logging strutturato | no | no | parziale | no | audit presente, logging tecnico scarso | logger centralizzato + correlation id | alta | M |
| Audit log | no | no | si, base | no | non tutte le azioni critiche tracciate | audit policy per dominio | alta | M |
| Redis cache | no | no | dichiarata, non pienamente attiva | no | non evidenza di caching applicativa | layer cache per query e invalidazione | media | M |
| Queue BullMQ | no | no | dichiarata, non implementata | no | nessun worker reale | job per export, notifiche, recurrence, scheduling | alta | L |
| Websocket realtime | no | no | si, base | no | broadcast generico, frontend ancora polling | socket client reale + channels scoped | media | M |
| Export dati | no | no | parziale | no | modulo presente ma non industrializzato | export job asincrono con storage e storico | media | M |
| AI settings provider-agnostic | si demo | no | parziale | parziale | settings separati ma non integrati in workflow | modellare provider registry e policy | bassa | M |
| Dark mode | si | parziale | parziale | parziale | token esistono, esperienza non rifinita | theme service + persistenza preferenze | bassa | S |
| Onboarding utente | parziale | no | si, basilare | parziale | stato semplificato | step guidati, progress, reminder | media | M |
| Documentazione dev/user | parziale | no | si, base | no | buona partenza ma incompleta | aggiornare con ADR, API map, user flows | media | M |

### Lettura della matrice
- `shift-complete` ha coperto bene lo scheletro architetturale.
- Il delta maggiore non e nello stack, ma nella profondita del dominio.
- Le aree piu carenti restano: ricorrenze vere, disponibilita, sostituzioni, CRUD admin completo, calendar UX reale, queue/worker e storage.

## 4. Architettura target consigliata

### Struttura Nx monorepo
- `apps/web`: Angular PWA.
- `apps/api`: NestJS API.
- `apps/worker`: worker BullMQ dedicato.
- `libs/core/auth`: policy, claims, permission map.
- `libs/core/rbac`: scope evaluation e guard condivise.
- `libs/domain/users`
- `libs/domain/teams`
- `libs/domain/events`
- `libs/domain/scheduling`
- `libs/domain/inventory`
- `libs/domain/resources`
- `libs/domain/notifications`
- `libs/domain/audit`
- `libs/domain/settings`
- `libs/data-access/api-client`
- `libs/data-access/contracts`
- `libs/ui/shell`
- `libs/ui/forms`
- `libs/ui/calendar`
- `libs/ui/dashboard`
- `libs/ui/dialogs`
- `libs/util/date`
- `libs/util/logging`
- `libs/util/export`
- `libs/infrastructure/storage`
- `libs/infrastructure/realtime`
- `libs/infrastructure/queue`

### Applicazioni e librerie consigliate

#### App Angular
- shell per ruolo
- feature areas lazy loaded
- state locale per feature, niente store globale finche non serve davvero
- query services tipizzati
- capability-driven UI

#### App NestJS
- moduli per dominio
- DTO e validation perimetralmente forti
- policy layer esplicito per scope su team/event/team membership
- audit obbligatorio sugli use case sensibili

#### Librerie condivise
- `contracts`: DTO condivisi solo dove utili
- `shared-types`: enum e modelli view-facing
- `ui-kit`: token e componenti base, senza logica di dominio

### Naming concreto
- `apps/web/src/app/features/admin-users`
- `apps/web/src/app/features/calendar`
- `apps/web/src/app/features/replacements`
- `apps/api/src/modules/event-recurrence`
- `apps/api/src/modules/availability`
- `apps/api/src/modules/replacements`
- `apps/api/src/modules/export-jobs`
- `apps/api/src/modules/duties`
- `libs/ui/calendar-board`
- `libs/domain/scheduling-engine`

### Valutazione dell’architettura attuale
- Buona scelta: `apps/web`, `apps/api`, `libs/shared-types`, `libs/ui-kit`.
- Insufficiente per la scala target: mancano worker dedicato, libs di dominio piu granulari e contratti condivisi piu netti.
- Raccomandazione: non rifare la repo; evolverla per slicing progressivo.

## 5. Dominio e modello dati

### Stato attuale del modello Prisma
- Buona base: `User`, `Team`, `TeamMembership`, `Event`, `EventSlot`, `Assignment`, `InventoryItem`, `ResourceFile`, `Notification`, `AuditLog`.
- Gap principali: nessuna entita per permessi granulari, disponibilita, sostituzioni, onboarding dettagliato, AI settings, dashboard preferences, export job, queue job, recurrence come aggregate separato.

### Entita minime target

#### User
- Scopo: identita applicativa.
- Attributi: id, email, passwordHash, fullName, status, roleBase, lastLoginAt.
- Relazioni: membership, assignment, notifications, settings, onboarding, availability.
- Vincoli: email univoca, stato attivo/sospeso.
- Audit/storico: si.
- Soft delete: si.
- Colore/icona: no.

#### Role
- Scopo: ruolo macro applicativo.
- Attributi: code, label, system.
- Relazioni: permissions, users.
- Vincoli: seed controllato.
- Audit: si.
- Soft delete: no.

#### Permission
- Scopo: capability atomica.
- Attributi: key, scopeType, description.
- Relazioni: role permissions.
- Vincoli: key univoca.
- Audit: si.
- Soft delete: no.

#### Team
- Scopo: contenitore operativo.
- Attributi: name, description, color, icon, status.
- Relazioni: leader assignment, memberships, duties, inventory, resources, events.
- Vincoli: name univoco per tenant.
- Audit: si.
- Soft delete: si.
- Colore/icona: si.

#### ServiceLeaderAssignment
- Scopo: assegnare leadership con periodo di validita.
- Attributi: teamId, userId, startsAt, endsAt, assignedBy.
- Relazioni: user, team.
- Vincoli: una leadership attiva per team.
- Audit: si.
- Soft delete: no.

#### Event
- Scopo: contenitore logico dell’evento.
- Attributi: title, description, type, status, startsAt, endsAt, color, icon.
- Relazioni: recurrence, slots, audit snapshots.
- Vincoli: startsAt < endsAt.
- Audit: si.
- Soft delete: si.
- Colore/icona: si.

#### EventRecurrence
- Scopo: governare serie ricorrenti.
- Attributi: rule, timezone, startsAt, until, exceptions.
- Relazioni: event series.
- Vincoli: valida solo per eventi recurring.
- Audit: si.
- Soft delete: no.
- Colore/icona: no.

#### ShiftAssignment
- Scopo: assegnazione di persona a slot/mansione.
- Attributi: status, source, autoAssigned, confirmedAt, declinedAt.
- Relazioni: slot, assignee, replacement.
- Vincoli: evitare overlap.
- Audit: si.
- Soft delete: no.
- Colore/icona: opzionale per stato.

#### Duty
- Scopo: catalogo mansioni per team.
- Attributi: name, code, description, color, icon, requiredSkills.
- Relazioni: team, slot templates.
- Vincoli: univocita per team.
- Audit: si.
- Soft delete: si.
- Colore/icona: si.

#### VolunteerProfile
- Scopo: profilo operativo del volontario.
- Attributi: phone, certifications, notes, emergencyContact.
- Relazioni: user.
- Vincoli: uno a uno.
- Audit: si.
- Soft delete: no.

#### InventoryItem
- Scopo: item di inventario.
- Attributi: name, serialNumber, status, teamId, maintenanceDueAt, location, category.
- Relazioni: team, maintenance logs.
- Vincoli: serialNumber opzionalmente unico.
- Audit: si.
- Soft delete: si.
- Colore/icona: si.

#### ToolEquipment
- Scopo: strumenti assegnabili/prestabili.
- Attributi: label, code, status, lastCheckAt.
- Relazioni: team, checkout history.
- Vincoli: code univoco.
- Audit: si.
- Soft delete: si.
- Colore/icona: si.

#### ResourceFile / Folder
- Scopo: documentazione e file operativi.
- Attributi: name, path, mimeType, sizeBytes, version, visibility.
- Relazioni: folder, team, uploader.
- Vincoli: ACL coerente con team/scope.
- Audit: si.
- Soft delete: si.
- Colore/icona: si.

#### Notification
- Scopo: comunicazioni di prodotto.
- Attributi: channel, subject, body, status, scheduledAt, sentAt.
- Relazioni: user, jobs.
- Vincoli: canale valido.
- Audit: si.
- Soft delete: no.
- Colore/icona: per severita.

#### AuditLog
- Scopo: storicizzare azioni e cambi critici.
- Attributi: actorId, action, entityType, entityId, metadata, correlationId.
- Relazioni: user.
- Vincoli: append-only.
- Audit: e l’audit stesso.
- Soft delete: no.
- Colore/icona: no.

#### UserSettings
- Scopo: preferenze utente.
- Attributi: theme, locale, timezone, notificationPrefs.
- Relazioni: user.
- Vincoli: uno a uno.
- Audit: si.
- Soft delete: no.

#### AISettings
- Scopo: configurazione provider-agnostic.
- Attributi: provider, model, enabled, redactionPolicy.
- Relazioni: tenant/system.
- Vincoli: una config attiva per scope.
- Audit: si.
- Soft delete: no.

#### DashboardPreference
- Scopo: preferenze dei widget.
- Attributi: layout, pinnedFilters, hiddenWidgets.
- Relazioni: user.
- Vincoli: uno a uno.
- Audit: si.
- Soft delete: no.

#### OnboardingState
- Scopo: avanzamento onboarding.
- Attributi: currentStep, completedSteps, completedAt.
- Relazioni: user.
- Vincoli: uno a uno.
- Audit: si.
- Soft delete: no.

#### Availability
- Scopo: disponibilita e indisponibilita operative.
- Attributi: startsAt, endsAt, type, note, recurrence.
- Relazioni: user.
- Vincoli: no overlap invalidi.
- Audit: si.
- Soft delete: si.
- Colore/icona: si.

#### Replacement
- Scopo: workflow di sostituzione.
- Attributi: assignmentId, requestedBy, status, reason, resolvedBy.
- Relazioni: assignment, users, notifications.
- Vincoli: una sostituzione aperta per assignment.
- Audit: si.
- Soft delete: no.
- Colore/icona: per stato.

#### ExportJob
- Scopo: esportazioni asincrone.
- Attributi: type, format, status, requestedBy, filePath.
- Relazioni: user, queue job.
- Vincoli: tracciamento stato.
- Audit: si.
- Soft delete: no.

#### QueueJob
- Scopo: rappresentazione applicativa dei job critici.
- Attributi: queueName, externalId, state, attempts, payloadHash.
- Relazioni: export, notification, recurrence.
- Vincoli: externalId univoco.
- Audit: si.
- Soft delete: no.

## 6. Matrice ruoli e permessi

### Amministratore
- Cosa vede: tutto.
- Cosa crea: team, leader assignment, utenti, eventi, mansioni, inventory, risorse, policy.
- Cosa modifica: tutto.
- Cosa elimina: tutto secondo policy di soft delete.
- Cosa approva: sostituzioni, policy, export sensibili, configurazioni.
- Cosa esporta: tutto.
- Cosa puo trascinare nel calendario: eventi, slot e assegnazioni globalmente.
- Cosa puo assegnare: leader, volontari, ruoli, mansioni.
- Cosa vede in dashboard: KPI globali, audit, backlog, coperture, inventory health.
- Limiti: nessuno sul tenant.

### Leader del servizio
- Cosa vede: solo team/eventi/risorse/volontari del proprio ambito.
- Cosa crea: eventi del proprio team, mansioni del proprio team, richieste di sostituzione.
- Cosa modifica: eventi, slot, assegnazioni, disponibilmente limitate al proprio scope.
- Cosa elimina: eventi e mansioni nel proprio scope se policy consentita.
- Cosa approva: conferme turni e sostituzioni del proprio team.
- Cosa esporta: dati del proprio team.
- Cosa puo trascinare nel calendario: slot e assegnazioni del proprio team.
- Cosa puo assegnare: volontari ai ruoli del proprio team.
- Cosa vede in dashboard: copertura servizio, vacanze, conflitti, onboarding incompleti del proprio team.
- Limiti: nessuna visibilita cross-team.

### Volontario
- Cosa vede: propri turni, notifiche, documenti autorizzati, disponibilita personale.
- Cosa crea: disponibilita, richieste sostituzione, aggiornamenti profilo.
- Cosa modifica: profilo, preferenze, disponibilita, conferma/rifiuto assegnazioni proprie.
- Cosa elimina: solo dati personali soft-removable dove consentito.
- Cosa approva: solo accettazione/rifiuto del proprio turno.
- Cosa esporta: agenda personale.
- Cosa puo trascinare nel calendario: niente, salvo futuri casi su preferenze personali.
- Cosa puo assegnare: nulla.
- Cosa vede in dashboard: KPI personali.
- Limiti: accesso strettamente personale.

### Ruoli aggiuntivi utili
- `inventory_manager`: opzionale, se l’inventario cresce come dominio forte.
- `auditor`: opzionale, accesso read-only a log/export.

## 7. Analisi funzione per funzione

### Auth
- Stato attuale nei progetti esistenti: presente ovunque; in `pdg_shift` e `shift-manager` dipende da PocketBase, in `shift-complete` c'e JWT reale con password hash.
- Problemi riscontrati: mancano refresh token, revoke, verify email, session hardening.
- Rischi: session hijacking, policy deboli, onboarding non governato.
- Refactor consigliato: access/refresh token, device/session table, rate limit, password reset.
- UX improvement: distinguere chiaramente login, registrazione e stato onboarding.
- Validazioni richieste: email univoca, password policy, throttling.
- Sicurezza: hash gia presente, ma servono refresh token e audit login.
- Logging/audit: login success/fail, lockout, password reset.
- Test da fare: auth controller/service, guard, refresh flow, RBAC.
- Priorita: alta.

### Register
- Stato attuale: presente ma minimale in `shift-complete`.
- Problemi: nessun verify email, nessuna gestione duplicate esplicita, nessun consenso/policy.
- Rischi: bassa qualita dati, account inconsistenti.
- Refactor: registration use case con transazione, onboarding state e notifica.
- UX: step guidato, copy chiara, feedback field-level.
- Validazioni: fullName, email, password, privacy.
- Sicurezza: anti-bot, anti-abuse.
- Logging/audit: `user.registered`.
- Test: validation, duplicate email, onboarding creation.
- Priorita: alta.

### Signin
- Stato attuale: funziona in forma base.
- Problemi: messaggistica generica, nessun remember device, nessun fallback.
- Rischi: support burden e scarsa osservabilita.
- Refactor: signin con error taxonomy e metriche.
- UX: stato loading, errori contestuali, reset password.
- Validazioni: formato email e password non vuota.
- Sicurezza: throttling e audit fail.
- Logging/audit: login fail/success.
- Test: auth happy path e fail path.
- Priorita: alta.

### CRUD utenti Amministratore
- Stato attuale: assente in `shift-complete`.
- Problemi: impossibile governare davvero il prodotto.
- Rischi: dipendenza da seed/manual DB.
- Refactor: modulo admin-users con list, create, edit, suspend, assign role.
- UX: tabella con filtri, stato onboarding, team, ruolo.
- Validazioni: scope e transizioni di ruolo.
- Sicurezza: solo Amministratore.
- Logging/audit: ogni cambio ruolo/stato.
- Test: permissions e filtri.
- Priorita: alta.

### UI role-based
- Stato attuale: parziale, ruolo noto ma non tutte le view reagiscono davvero.
- Problemi: rischio di azioni non dovute lato UI.
- Rischi: confusione, errori di aspettativa.
- Refactor: capability map centralizzata.
- UX: menu e CTA contestuali.
- Validazioni: allineare UI e policy backend.
- Sicurezza: mai affidarsi solo alla UI.
- Logging/audit: accessi negati significativi.
- Test: rendering per ruolo.
- Priorita: alta.

### UX flow
- Stato attuale: `pdg_shift` ricco ma farraginoso; `shift-manager` semplice ma povero; `shift-complete` piu pulito ma ancora dimostrativo.
- Problemi: molte azioni richiedono refresh completi e dialog generici.
- Rischi: adoption bassa e errori operativi.
- Refactor: ridurre roundtrip mentali, consolidare flows.
- UX: drawer contestuali, empty states, tooltip descrittivi, sticky actions.
- Validazioni: stato asincrono chiaro.
- Sicurezza: conferme esplicite per azioni distruttive.
- Logging/audit: tracciare workflow critici.
- Test: smoke E2E su journey per ruolo.
- Priorita: alta.

### Calendar view
- Stato attuale: `shift-complete` ha una griglia custom semplificata, non un calendario di produzione.
- Problemi: niente navigazione reale tra mesi/settimane, niente timezone/overflow seri.
- Rischi: vista fuorviante per pianificazione.
- Refactor: calendar engine vero con month/week resource views.
- UX: filtri persistenti, badge vacanti/coperti, tooltip ricchi.
- Validazioni: coerenza date e overlap.
- Sicurezza: scope per team/utente.
- Logging/audit: non necessario per sola lettura, si per mutazioni.
- Test: rendering range, DST, ricorrenze.
- Priorita: alta.

### Calendar drag and drop eventi
- Stato attuale: solo drag and drop dei volontari sugli slot.
- Problemi: non esiste move/resize evento.
- Rischi: requisito non soddisfatto.
- Refactor: DnD con optimistic update e rollback.
- UX: snap time, preview impatto, conferma se conflitti.
- Validazioni: permessi, overlap, rest window.
- Sicurezza: backend authoritative.
- Logging/audit: `event.rescheduled`, `assignment.moved`.
- Test: DnD policy e conflitti.
- Priorita: alta.

### CRUD eventi
- Stato attuale: presente in `shift-complete`, ma ancora MVP.
- Problemi: update non gestisce lifecycle completo di slot e ricorrenze.
- Rischi: dati inconsistenti.
- Refactor: aggregate con update semantico.
- UX: editor evento piu ricco, template slot, warning conflitti.
- Validazioni: start/end, team ownership, recurrence consistency.
- Sicurezza: scope leader/team.
- Logging/audit: create/update/delete e reason.
- Test: create/update/delete + policy.
- Priorita: alta.

### CRUD risorse / file manager
- Stato attuale: modulo risorse presente, ma non emerge upload/storage reale.
- Problemi: file manager ancora nominale.
- Rischi: feature incompleta percepita come presente.
- Refactor: storage abstraction, folder ACL, metadata/versioning.
- UX: tree, drag upload, preview, filtro per team.
- Validazioni: mime, size, ACL.
- Sicurezza: signed URLs, scan pipeline se necessario.
- Logging/audit: upload/download/delete.
- Test: ACL e upload lifecycle.
- Priorita: media.

### Assegnazione utenti ai ruoli negli eventi
- Stato attuale: presente in `shift-complete`.
- Problemi: `roleName` free text, niente duty catalog, niente conferma workflow.
- Rischi: incoerenza semantica e reporting povero.
- Refactor: slot -> duty -> assignment, con stati piu completi.
- UX: assignment board con filtri skill/disponibilita.
- Validazioni: overlap, eligibility, membership.
- Sicurezza: leader solo sul proprio scope.
- Logging/audit: assignment create/update/reassign.
- Test: policy e overlap.
- Priorita: alta.

### CRUD team
- Stato attuale: presente in `shift-complete`.
- Problemi: dominio team ancora sottile.
- Rischi: team non governano veramente le policy operative.
- Refactor: settings team, default duties, colore/icona, stato.
- UX: pagina team con overview completa.
- Validazioni: leader ownership, name uniqueness.
- Sicurezza: solo Amministratore per creazione e governance globale.
- Logging/audit: leader changes, membership changes.
- Test: CRUD e RBAC.
- Priorita: alta.

### CRUD mansioni nel team
- Stato attuale: assente.
- Problemi: oggi si usa una stringa su slot.
- Rischi: impossibile standardizzare ruoli, skill e report.
- Refactor: entita `Duty`.
- UX: catalogo mansioni con colore/icona.
- Validazioni: univocita per team.
- Sicurezza: admin/leader nel proprio scope.
- Logging/audit: create/update/archive.
- Test: CRUD.
- Priorita: alta.

### Validazione frontend/backend
- Stato attuale: base sul backend, molto poco esplicita sul frontend.
- Problemi: mismatch potenziali tra form UI e DTO.
- Rischi: errori runtime, UX povera.
- Refactor: schemi condivisi dove utile, error mapping coerente.
- UX: field errors e summary.
- Validazioni: date, email, role transitions, recurrence.
- Sicurezza: validation server sempre authoritative.
- Logging/audit: validation failures aggregate.
- Test: DTO + integration.
- Priorita: alta.

### Toast, log e gestione errori/stati
- Stato attuale: forte nei demo frontend, piu debole in `shift-complete`.
- Problemi: poche taxonomy di errori e feedback.
- Rischi: debugging lento e UX opaca.
- Refactor: error presenter condiviso, typed error responses.
- UX: toast non invasivi + inline errors + states skeleton/empty.
- Validazioni: codici errore stabili.
- Sicurezza: messaggi sicuri, niente leak.
- Logging/audit: correlation ID.
- Test: mapping errori.
- Priorita: alta.

### Algoritmo automatico turni
- Stato attuale: presente in `shift-complete` come preview semplice basata su membership e fairness rudimentale.
- Problemi: niente availability reale, skill, riposo, priorita sostituzioni, explainability forte.
- Rischi: assegnazioni ingiuste o inutilizzabili.
- Refactor: scheduling engine separato con scoring trasparente.
- UX: preview spiegata, simulazione, apply selettivo.
- Validazioni: no overlap, skill match, rest rules.
- Sicurezza: apply solo ad attori autorizzati.
- Logging/audit: criteria snapshot e diff.
- Test: motore con dataset deterministici.
- Priorita: alta.

### Checklist websocket, redis, queue, cache
- Stato attuale: websocket base presente, redis/queue/caching soprattutto dichiarativi.
- Problemi: disallineamento tra architettura promessa e runtime reale.
- Rischi: falsa sensazione di completezza.
- Refactor: worker reale, redis-backed pubsub, cache invalidation policy.
- UX: realtime vero per notifiche e pianificazione.
- Validazioni: retry, idempotenza.
- Sicurezza: auth socket, scope channel.
- Logging/audit: job lifecycle e socket events.
- Test: integration redis/queue.
- Priorita: alta.

### Dashboard usabile, descrittiva, con semafori
- Stato attuale: UI buona, dati ancora hardcoded o semplificati.
- Problemi: KPI non affidabili.
- Rischi: dashboard decorativa e non operativa.
- Refactor: read models aggregate per ruolo.
- UX: semafori reali, drill-down, data freshness.
- Validazioni: metric definitions condivise.
- Sicurezza: scope dataset.
- Logging/audit: export/report access.
- Test: query aggregate.
- Priorita: alta.

### Tooltip descrittivi UI
- Stato attuale: presenti come intenzione nei demo; poco sistematici in `shift-complete`.
- Problemi: affordance parziale.
- Rischi: onboarding lento per leader/volontari.
- Refactor: helper text system e tooltip coerenti.
- UX: spiegare stati, semafori, ruoli, criteri algoritmici.
- Validazioni: copy chiara e consistente.
- Sicurezza: non rilevante.
- Logging/audit: non necessario.
- Test: visual regressions opzionali.
- Priorita: media.

### Icone e colori personalizzabili
- Stato attuale: presente piu nelle demo che nel modello `shift-complete`.
- Problemi: il database attuale non supporta bene personalizzazione di team, eventi e mansioni.
- Rischi: UI meno leggibile e meno governabile.
- Refactor: aggiungere `color` e `icon` a Team, Event, Duty.
- UX: legenda e semafori coerenti.
- Validazioni: whitelist icone/colori.
- Sicurezza: sanificazione input.
- Logging/audit: modifiche branding operative.
- Test: CRUD base.
- Priorita: media.

## 8. Valutazione critica dello stato attuale di `shift-complete`

### Cosa e gia buono
- Nx monorepo reale.
- Angular + NestJS + Prisma allineati al target.
- Seed e ruoli base gia coerenti con la terminologia `Amministratore`.
- Primo RBAC backend.
- Audit log gia introdotto.
- Moduli principali gia tracciati nel backend.

### Cosa e solo apparentemente coperto
- Realtime completo: oggi e solo base.
- Scheduling avanzato: oggi e una demo algoritmica.
- Calendar UX: oggi e un calendario custom semplificato.
- Notifications enterprise: oggi non sono pipeline robuste.
- Resources/file manager: dominio appena abbozzato.
- Export: presente come area, non come sistema asincrono completo.

### Debiti tecnici gia visibili in `shift-complete`
- `AppApiService` usa `any` e URL hardcoded.
- Dashboard con metriche statiche.
- Modello dati incompleto rispetto al prompt.
- Nessun test reale rilevato sulle aree core.
- Mancano worker ed effettiva integrazione BullMQ.

### Decisione
- Non serve rifondare `shift-complete`.
- Serve una fase 2 di consolidamento forte, con focus su dominio, policy, dati e runtime infrastructure.

## 9. Roadmap di esecuzione consigliata

### Fase 1: hardening piattaforma
- refresh token
- admin CRUD utenti
- capability map UI/backend
- environment config pulita
- typed API client
- test integrazione auth/team/event

### Fase 2: dominio scheduling corretto
- duties
- availability
- replacements
- recurrence engine
- event update semantico
- dashboard query reali

### Fase 3: collaboration e operations
- worker BullMQ
- notifiche asincrone
- websocket scoped
- export job
- file storage reale

### Fase 4: UX enterprise
- calendario mese/settimana vero
- DnD completo
- onboarding raffinato
- tooltip/help system
- theming e personalization

## 10. Verdict finale

`pdg_shift` contiene il prodotto da emulare come profondita funzionale.

`shift-manager` contiene il frontend stack piu vicino al target ma resta embrionale.

`shift-complete` e la scelta corretta come base di sviluppo, ma oggi non soddisfa ancora il prompt `update` come prodotto finito: soddisfa bene la direzione architetturale, solo parzialmente il dominio, e in modo ancora incompleto i workflow chiave.

La prossima iterazione non deve essere "aggiungere altre pagine", ma rendere reali le feature gia accennate: dati, policy, ricorrenze, disponibilita, sostituzioni, queue, realtime e dashboard basata su metriche vere.
