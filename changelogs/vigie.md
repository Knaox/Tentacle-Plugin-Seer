# Changelog — Vigie

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

## [1.14.0]
### FR
- **Le plugin s'appelle désormais Vigie.** Il n'est affilié ni à Jellyseerr ni à Overseerr : c'est un plugin indépendant qui se connecte à votre propre instance. La mention figure dans le README, sur la fiche de la marketplace et sur la page de configuration
- **Pages renommées** : « Découvrir » devient **Catalogue** (ce qui n'est pas encore dans votre bibliothèque et que vous pouvez demander), « Demandes » devient **Mes demandes** partout — le même écran portait jusqu'ici trois noms différents
- **Nouvelle page Sorties** : les prochaines dates de vos demandes en attente (sortie en ligne des films, prochain épisode des séries), plus un mode « Tout ce qui sort » et un mode par plateforme (Crunchyroll, Netflix, Disney+, ADN, Canal+… 80 disponibles en France). Vue liste ou vue mois, et on peut demander un titre directement depuis le calendrier
- **On sait enfin si un titre est vraiment sorti.** Un film annoncé « 2026 » peut être au cinéma sans exister nulle part ailleurs : le catalogue signale désormais « Au cinéma », « En ligne le 3 sept. » ou « Sortie le 16 déc. ». Rien ne s'affiche quand le titre est récupérable — le mot « Disponible » reste réservé à votre bibliothèque. Le bouton devient « Demander quand même », avec l'explication
- **Progression réelle des téléchargements** : pourcentage, taille et temps restant remontés par Sonarr / Radarr, à la place de la barre d'étapes symbolique. La barre avance en continu entre deux rafraîchissements, sans requête supplémentaire, et rien n'est interrogé quand aucun téléchargement n'est en cours ou que l'onglet est en arrière-plan
- **Mes demandes s'ouvre en une fraction de seconde** au lieu de plusieurs dizaines de secondes. Les fiches (titres, affiches, dates) sont mémorisées durablement et survivent au redémarrage du serveur ; les statistiques arrivent avec la liste au lieu de la recharger une seconde fois ; l'expiration du cache ne fait plus attendre personne
- Le raccourci affiche **⌘K sur Mac** au lieu de « Ctrl+K », et fonctionne aussi sur Mes demandes qui n'en avait aucun
- Revenir sur une page du plugin la rouvre **en haut**
- Les pages du plugin peuvent être **retirées de la barre de navigation** (menu « Bibliothèques ») ; elles y sont par défaut
- Correctif : une suppression par un utilisateur ne vidait plus seulement son propre cache mais celui de tout le monde

### EN
- **The plugin is now called Vigie.** It is affiliated with neither Jellyseerr nor Overseerr: it is an independent plugin connecting to your own instance. Stated in the README, on the marketplace listing and on the settings page
- **Pages renamed**: "Discover" becomes **Catalog** (what is not yet in your library and can be requested), "Requests" becomes **My Requests** everywhere — the same screen used to carry three different names
- **New Releases page**: upcoming dates for your pending requests (digital release for movies, next episode for shows), plus an "Everything" mode and a per-platform mode (Crunchyroll, Netflix, Disney+, ADN, Canal+… 80 available in France). List or month view, and titles can be requested straight from the calendar
- **You can finally tell whether a title is actually out.** A movie labelled "2026" may be in theaters and nowhere else: the catalog now says "In theaters", "Online Sept 3" or "Out Dec 16". Nothing is shown when the title is obtainable — "Available" stays reserved for your library. The button becomes "Request anyway", with an explanation
- **Real download progress**: percentage, size and time left reported by Sonarr / Radarr, replacing the symbolic step bar. The bar advances smoothly between refreshes with no extra request, and nothing is polled when no download is running or the tab is in the background
- **My Requests opens in a fraction of a second** instead of tens of seconds. Metadata (titles, posters, dates) is stored durably and survives a server restart; stats come with the list instead of reloading it a second time; cache expiry no longer makes anyone wait
- The shortcut hint shows **⌘K on Mac** instead of "Ctrl+K", and now works on My Requests too
- Returning to a plugin page reopens it **at the top**
- Plugin pages can be **removed from the navigation bar** (Libraries menu); they are pinned by default
- Fix: one user deleting a request used to clear everyone's cache, not just their own

## [1.13.2]
### FR
- Thème clair 100 % lisible : le hero « Découvrir » garde une image vive avec texte blanc sur dégradé sombre (fini le titre invisible), les chips de statut, statistiques, boutons d'action et survols de cartes suivent désormais le thème avec un vrai contraste (« Partiellement dispo. » n'est plus jaune sur jaune)
- Le repli de thème du plugin gère désormais clair ET sombre (détection du schéma de l'hôte — web, desktop et mobile) et complète les tokens manquants sur mobile (surfaces, remplissages, statuts)
### EN
- Fully readable light theme: the Discover hero keeps vivid artwork with white text over a dark gradient (no more invisible title); status chips, statistics, action buttons and card hovers now follow the theme with proper contrast ("Partially available" is no longer yellow-on-yellow)
- The plugin's theme fallback now handles light AND dark (host scheme detection — web, desktop and mobile) and fills in missing tokens on mobile (surfaces, fills, statuses)

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
