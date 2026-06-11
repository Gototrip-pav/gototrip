// app/data/mockData.ts

export type DestinationCard = {
  slug: string;            // slug ASCII (pas d'accents)
  city: string;
  country: string;
  weather: string;         // ex "☀️ 26°C"
  price: number;           // estimation totale (approx.)
  tags: string[];          // ex ["Mer", "Kayak"]
  lodging: string[];       // ex ["hotel", "appartement"]
  cover: string;           // /destinations/xxx.jpg (dans /public)
};

export type DestinationDetail = {
  header: {
    slug: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
    weather: string;
    cover: string;
  };
  activities: {
    id: string;
    name: string;
    pricePerPerson: number;
    lat: number;
    lng: number;
    link: string;
  }[];
  restaurants: {
    id: string;
    name: string;
    pricePerPerson: number;
    lat: number;
    lng: number;
    link: string;
  }[];
  stays: {
    id: string;
    name: string;
    type: "hotel" | "appartement" | "auberge" | "camping";
    pricePerNightPerPerson: number;
    lat: number;
    lng: number;
    link: string;
  }[];
};

// === Cartes de la page /destinations ===
export const DESTINATIONS: DestinationCard[] = [
  {
    slug: "majorque",
    city: "Majorque",
    country: "Espagne",
    weather: "☀️ 26°C",
    price: 980,
    tags: ["Mer", "Kayak", "Plage"],
    lodging: ["hotel", "appartement"],
    cover: "/destinations/majorque.jpg",
  },
  {
    slug: "la-canee", // ASCII sans accent !
    city: "La Canée",
    country: "Crète",
    weather: "☀️ 27°C",
    price: 1050,
    tags: ["Mer", "Snorkeling"],
    lodging: ["hotel", "appartement", "auberge"],
    cover: "/destinations/la-canee.jpg",
  },
];

// === Détails par slug pour /destinations/[slug] ===
export const DETAIL_BY_SLUG: Record<string, DestinationDetail> = {
  "majorque": {
    header: {
      slug: "majorque",
      city: "Majorque",
      country: "Espagne",
      lat: 39.6953,
      lng: 3.0176,
      weather: "☀️ 26°C",
      cover: "/destinations/majorque.jpg",
    },
    activities: [
      {
        id: "maj-act-1",
        name: "Kayak à Cala Varques",
        pricePerPerson: 32,
        lat: 39.5516,
        lng: 3.3227,
        link: "https://example.com/kayak-cala-varques",
      },
      {
        id: "maj-act-2",
        name: "Tram de Sóller + village",
        pricePerPerson: 20,
        lat: 39.7666,
        lng: 2.7156,
        link: "https://example.com/tram-soller",
      },
      {
        id: "maj-act-3",
        name: "Randonnée Tramuntana",
        pricePerPerson: 25,
        lat: 39.7100,
        lng: 2.6470,
        link: "https://example.com/rando-tramuntana",
      },
    ],
    restaurants: [
      {
        id: "maj-food-1",
        name: "Bar à tapas du centre",
        pricePerPerson: 22,
        lat: 39.5700,
        lng: 2.6500,
        link: "https://example.com/bar-tapas",
      },
      {
        id: "maj-food-2",
        name: "Paella bord de mer",
        pricePerPerson: 26,
        lat: 39.5550,
        lng: 2.6400,
        link: "https://example.com/paella-mercado",
      },
    ],
    stays: [
      {
        id: "maj-stay-1",
        name: "Hôtel Palma Centro",
        type: "hotel",
        pricePerNightPerPerson: 58,
        lat: 39.5710,
        lng: 2.6505,
        link: "https://example.com/hotel-palma",
      },
      {
        id: "maj-stay-2",
        name: "Appartement Sóller",
        type: "appartement",
        pricePerNightPerPerson: 44,
        lat: 39.7660,
        lng: 2.7140,
        link: "https://example.com/app-soller",
      },
      {
        id: "maj-stay-3",
        name: "Auberge Playa",
        type: "auberge",
        pricePerNightPerPerson: 29,
        lat: 39.5500,
        lng: 2.6400,
        link: "https://example.com/auberge-playa",
      },
    ],
  },

  "la-canee": {
    header: {
      slug: "la-canee",
      city: "La Canée",
      country: "Crète",
      lat: 35.5138,
      lng: 24.0180,
      weather: "☀️ 27°C",
      cover: "/destinations/la-canee.jpg",
    },
    activities: [
      {
        id: "can-act-1",
        name: "Snorkeling à Agioi Apostoloi",
        pricePerPerson: 28,
        lat: 35.5149,
        lng: 23.9802,
        link: "https://example.com/snorkeling-agioi",
      },
      {
        id: "can-act-2",
        name: "Balade vieille ville + port",
        pricePerPerson: 15,
        lat: 35.5160,
        lng: 24.0189,
        link: "https://example.com/walking-old-town",
      },
    ],
    restaurants: [
      {
        id: "can-food-1",
        name: "Taverna du port",
        pricePerPerson: 20,
        lat: 35.5158,
        lng: 24.0192,
        link: "https://example.com/taverna-port",
      },
      {
        id: "can-food-2",
        name: "Poissons grillés Nea Chora",
        pricePerPerson: 24,
        lat: 35.5155,
        lng: 24.0055,
        link: "https://example.com/nea-chora-fish",
      },
    ],
    stays: [
      {
        id: "can-stay-1",
        name: "Hôtel Agora",
        type: "hotel",
        pricePerNightPerPerson: 55,
        lat: 35.5167,
        lng: 24.0196,
        link: "https://example.com/hotel-agora",
      },
      {
        id: "can-stay-2",
        name: "Appartement Nea Chora",
        type: "appartement",
        pricePerNightPerPerson: 42,
        lat: 35.5160,
        lng: 24.0065,
        link: "https://example.com/app-nea-chora",
      },
      {
        id: "can-stay-3",
        name: "Auberge du Vieux Port",
        type: "auberge",
        pricePerNightPerPerson: 27,
        lat: 35.5155,
        lng: 24.0183,
        link: "https://example.com/auberge-port",
      },
    ],
  },
};
