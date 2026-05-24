export const customStyle = [
  // 🌍 Background & Base Styling
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }, { weight: 2 }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#8ec3b9" }, { weight: 1.2 }],
  },
  { elementType: "labels.icon", stylers: [{ visibility: "simplified" }] }, // Simplify icons for cleaner look

  // 🏡 Neighborhood Labels (Improved Visibility)
  {
    featureType: "administrative.neighborhood",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b0a087" }, { weight: 1.5 }],
  },
  {
    featureType: "administrative.neighborhood",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }, { weight: 2.5 }],
  },

  // 🌆 Administrative Boundaries (Cities, Regions)
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#a8b5c2" }],
  },
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ color: "#3a4a6b" }, { weight: 1.5 }],
  },

  // 🏛️ Business & Government POIs (Differentiated Styles)
  {
    featureType: "poi.business",
    elementType: "geometry",
    stylers: [{ color: "#2c3b59" }, { saturation: 20 }],
  },
  {
    featureType: "poi.business",
    elementType: "labels.text.fill",
    stylers: [{ color: "#ffcc00" }, { weight: 1.3 }],
  },
  {
    featureType: "poi.government",
    elementType: "geometry",
    stylers: [{ color: "#3e4b5b" }, { saturation: 10 }],
  },
  {
    featureType: "poi.medical",
    elementType: "geometry",
    stylers: [{ color: "#5f4351" }, { lightness: 10 }],
  },
  {
    featureType: "poi.medical",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d4a3b1" }],
  },

  // 🏬 Other POIs (Attractions, Religious, Schools)
  {
    featureType: "poi.attraction",
    elementType: "geometry",
    stylers: [{ color: "#3b4a6a" }],
  },
  {
    featureType: "poi.attraction",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f4a261" }],
  },
  {
    featureType: "poi.place_of_worship",
    elementType: "geometry",
    stylers: [{ color: "#4a3f5b" }],
  },
  {
    featureType: "poi.school",
    elementType: "geometry",
    stylers: [{ color: "#3f4a5b" }],
  },
  {
    featureType: "poi.school",
    elementType: "labels.text.fill",
    stylers: [{ color: "#a8b5c2" }],
  },

  // 🚦 Roads: Local, Arterial, & Highways
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2b3b59" }, { saturation: -10 }],
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#374b6e" }, { weight: 2 }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#49505a" }, { weight: 2.5 }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#ff8c00" }, { weight: 3 }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e65100" }, { weight: 1 }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }, { weight: 3 }],
  },

  // 🚇 Transit Enhancements: Railways, Stations, & Airports
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }, { saturation: -20 }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#4b5d73" }, { weight: 1.5 }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "transit.station.airport",
    elementType: "geometry",
    stylers: [{ color: "#4a3f5b" }],
  },
  {
    featureType: "transit.station.airport",
    elementType: "labels.text.fill",
    stylers: [{ color: "#e6b800" }],
  },

  // 🌳 Parks & Green Areas (Balanced Contrast)
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1e3d49" }, { saturation: 30 }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#2a3f4d" }],
  },

  // 🌊 Water Styling
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }, { lightness: -10 }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }, { weight: 2 }],
  },

  // 🏔️ Terrain & Elevation
  {
    featureType: "landscape.natural.terrain",
    elementType: "geometry",
    stylers: [{ color: "#2d3e5a" }, { lightness: -20 }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#2c3b59" }],
  },

  // 🔲 Simplified Miscellaneous Features
  {
    featureType: "poi.sports_complex",
    elementType: "geometry",
    stylers: [{ color: "#3b4a6a" }],
  },
  {
    featureType: "poi.sports_complex",
    elementType: "labels.text.fill",
    stylers: [{ color: "#a8b5c2" }],
  },
];
