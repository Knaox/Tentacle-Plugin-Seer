# Changelog — Seer

Notes de version du plugin, lues par le workflow de publication (`.github/workflows/publish.yml`)
pour la Release GitHub ET le champ `changelog` du marketplace.

Format (bilingue) — un bloc par version, plus récent en haut :

```
## [X.Y.Z]
### FR
- Ligne de note en français
### EN
- English note line
```

Si aucun bloc ne correspond à la version publiée, le workflow retombe sur le
sujet du commit (publication sans friction). Le numéro de version est
auto-bumpé par le message du commit (`feat`→mineure, `fix`→patch, `!`→majeure).

---

## [1.13.1]
### FR
- Demande de saison : une saison demandée apparaît **immédiatement** comme « Demandé » et ne peut plus être redemandée par erreur. Le verrou s'appuie désormais sur la file locale du plugin (et non sur Jellyseerr, qui accusait un décalage) : il tient dès le clic et survit au rafraîchissement de la page.
### EN
- Season request: a requested season now shows as “Requested” **immediately** and can no longer be re-requested by mistake. The lock now relies on the plugin's local queue (instead of Jellyseerr, which lagged behind): it holds from the moment you click and survives a page refresh.

## [1.13.0]
### FR
- Disponibilité par-saison : une demande de saison(s) est désormais considérée disponible dès que les saisons DEMANDÉES sont présentes, même si le reste de la série manque — fini les demandes bloquées en « partiellement disponible » sans notification.
- Notifications enrichies : « Saison N est sortie sur Tentacle TV » (accord grammatical film/série/saison), avec une notification dès qu'une partie des saisons demandées arrive (ex. 2/3 saisons) puis pour les suivantes.
- Réconciliation de disponibilité accélérée côté Jellyseerr (rafraîchissement de l'état par saison).
- Notifications épurées : Seer ne notifie plus qu'aux étapes utiles — en cours de téléchargement, sortie, et échec définitif. Fini les notifications « demande envoyée », « approuvée » et les tentatives automatiques (anti-spam).
- Anti-doublon : quand une demande devient disponible, une seule notification part (celle de Seer) — plus de doublon avec la notification « ajout bibliothèque » (nécessite le serveur ≥ 1.5.5).
- Notification même si déjà présent : demander un contenu déjà dans la bibliothèque envoie quand même la notification « disponible » (avant : silence).

### EN
- Per-season availability: a season request is now considered available as soon as the REQUESTED seasons are present, even if the rest of the series is missing — no more requests stuck as "partially available" with no notification.
- Richer notifications: "Season N is now on Tentacle TV", with a notification as soon as some of the requested seasons arrive (e.g. 2 of 3) and again for the following ones.
- Faster availability reconciliation on the Jellyseerr side (per-season status refresh).
- Streamlined notifications: Seer now only notifies at useful stages — downloading, released, and permanent failure. No more "request sent", "approved" or auto-retry notifications (anti-spam).
- Deduplication: when a request becomes available, only one notification is sent (Seer's) — no more duplicate with the "library added" notification (requires server ≥ 1.5.5).
- Notify even if already present: requesting content already in the library still sends the "available" notification (previously: silent).

## [1.12.0]
### FR
- Support complet du thème CLAIR : surfaces, textes, boutons et modales suivent désormais le thème de l'application (fini le texte blanc sur fond blanc).
- Boutons et champs branchés sur les tokens sémantiques de l'hôte (cohérence clair/sombre garantie).

### EN
- Full LIGHT theme support: surfaces, text, buttons and modals now follow the host app theme (no more white-on-white text).
- Buttons and inputs wired to the host semantic tokens (guaranteed light/dark consistency).
