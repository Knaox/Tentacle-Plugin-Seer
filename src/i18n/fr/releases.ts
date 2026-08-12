export default {
  // Disponibilité — PAR OÙ un titre est sorti, et ce qu'une demande peut espérer.
  // Ne jamais employer « Disponible » ici : ce mot désigne, sur Mes demandes,
  // un titre déjà téléchargé et présent dans la bibliothèque. On nomme le
  // canal (salle, en ligne, Blu-ray), jamais un état de possession.
  availStillInTheaters: "Encore au cinéma",
  availInTheaters: "Au cinéma",
  availInTheatersLong: "Encore au cinéma depuis le {{date}}",
  availTheatricalSoon: "Au cinéma le {{date}}",
  availTheatricalSoonLong: "Sortie en salle le {{date}}",
  availDigitalOut: "En ligne",
  availDigitalOutLong: "Sorti en ligne le {{date}}",
  availOnlineOn: "En ligne le {{date}}",
  availOnlineOnLong: "Sortie en ligne le {{date}}",
  availPhysicalOut: "En Blu-ray",
  availPhysicalOutLong: "Sorti en DVD / Blu-ray le {{date}}",
  availPhysicalSoon: "Blu-ray le {{date}}",
  availPhysicalSoonLong: "Sortie en DVD / Blu-ray le {{date}}",
  availReleaseOn: "Sortie le {{date}}",
  availReleaseOnLong: "Pas encore sorti — prévu le {{date}}",
  availAirsOn: "Diffusion le {{date}}",
  availAirsOnLong: "Première diffusion le {{date}}",
  availNotAiredYet: "Diffusion pas encore commencée",
  // Les chances d'aboutir, sans jamais les chiffrer ni les promettre.
  availOutlookLikely: "Une version existe : la demande a de bonnes chances d'aboutir.",
  availOutlookUnlikely:
    "Encore en salle uniquement : peu de chances qu'une version circule déjà.",
  availOutlookNotYet: "Rien n'est encore sorti : la demande restera en attente jusque-là.",
  availRequestAnyway: "Demander quand même",
  availRequestAnywayHint:
    "Le téléchargement ne pourra pas démarrer avant la sortie. La demande restera en attente jusque-là.",

  // Progression réelle des téléchargements
  progressRemaining: "≈ {{eta}} restantes",
  progressPaused: "En pause",
  // Le fichier est complet mais pas encore rangé dans la bibliothèque.
  // Court dans la puce, qui partage sa ligne avec un titre tronqué.
  statusValidating: "En cours de validation",
  progressValidating: "Téléchargement terminé — vérification et rangement en cours",
  progressSearching: "Recherche d'une source en cours",
  progressEpisodes_one: "{{count}} épisode en cours",
  progressEpisodes_other: "{{count}} épisodes en cours",
  // Détail par saison d'une demande de série
  progressSeason: "Saison {{season}}",
  progressSeasonWaiting: "En attente",
  progressNoSeason: "Hors saison",

  // Page Sorties
  navReleases: "Sorties",
  releasesTitle: "Sorties",
  releasesSubtitle: "Les prochaines dates de vos demandes et des plateformes",
  releasesTabPersonal: "Mes sorties",
  releasesTabAll: "Tout",
  releasesScopeUpcoming: "À venir",
  releasesScopeAll: "Toutes mes demandes",
  releasesViewWeek: "Semaine",
  releasesViewMonth: "Mois",
  releasesEmptyPersonal: "Aucune sortie à venir parmi vos demandes",
  releasesEmptyPersonalHint:
    "Les titres déjà dans votre bibliothèque n'apparaissent pas ici.",
  releasesEmptyGlobal: "Aucune sortie annoncée sur cette période",
  releasesPartial: "Chargement des dates en cours…",
  // Filtres de l'agenda — plusieurs plateformes à la fois
  releasesFiltersTitle: "Filtres des sorties",
  filterType: "Type",
  releasesFilterPlatformsHint:
    "Une sortie apparaît si au moins une des plateformes cochées la propose.",
  releasesEmptyFiltered: "Aucune sortie sur les plateformes choisies",
  releasesEmptyFilteredHint:
    "Un titre pas encore sorti n'est proposé par aucune plateforme : il n'apparaît donc pas ici.",
  releasesShowResults_one: "Voir {{count}} sortie",
  releasesShowResults_other: "Voir {{count}} sorties",
  releasesFilterAll: "Tout",
  releasesFilterMovies: "Films",
  releasesFilterTv: "Séries",
  releasesToday: "Aujourd'hui",
  releasesTomorrow: "Demain",
  releasesThisMonth: "Ce mois-ci",
  releasesKindDigital: "En ligne",
  releasesKindTheatrical: "Au cinéma",
  releasesKindPhysical: "Blu-ray / DVD",
  releasesKindEpisode: "Épisode",
  releasesKindPremiere: "Sortie",
  releasesRequested: "Demandé",

  // Plateformes de streaming — « où puis-je déjà le regarder »
  streamingOn: "En streaming sur {{platforms}}",
  streamingLabel: "À voir sur",
  streamingNone: "Sur aucune plateforme d'abonnement",
  releasesCount_one: "{{count}} sortie",
  releasesCount_other: "{{count}} sorties",
  releasesMonthPrev: "Mois précédent",
  releasesMonthNext: "Mois suivant",
  releasesWeekPrev: "Semaine précédente",
  releasesWeekNext: "Semaine suivante",
  releasesThisWeek: "Cette semaine",
  releasesWindow30: "30 jours",
  releasesWindow90: "3 mois",
  releasesWindow180: "6 mois",
} as const;
