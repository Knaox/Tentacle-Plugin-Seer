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

## [1.12.0]
### FR
- Support complet du thème CLAIR : surfaces, textes, boutons et modales suivent désormais le thème de l'application (fini le texte blanc sur fond blanc).
- Boutons et champs branchés sur les tokens sémantiques de l'hôte (cohérence clair/sombre garantie).

### EN
- Full LIGHT theme support: surfaces, text, buttons and modals now follow the host app theme (no more white-on-white text).
- Buttons and inputs wired to the host semantic tokens (guaranteed light/dark consistency).
