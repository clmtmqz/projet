//Flux

var Stadia_StamenTerrainBackground = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 18,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
});

var CartoDB_PositronOnlyLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 20
});

var Esri_WorldShadedRelief = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
	maxZoom: 13
});

// Initialisation de la carte
var myMap = L.map('map', {
    center: [47, 1],
    zoom: 5,
    layers: [Esri_WorldShadedRelief, CartoDB_PositronOnlyLabels]
});

var url_data = 'https://clmtmqz.github.io/projet/data/deded.geojson';

// Utilisation de fetch pour récupérer le fichier GeoJSON
fetch(url_data)
  .then(response => {
    // Vérifier si la réponse est correcte (code HTTP 200)
    if (!response.ok) {
      throw new Error('Erreur réseau : ' + response.statusText);
    }
    return response.json(); // Convertir la réponse en JSON
  })
  .then(data1 => {
    // Ajouter la couche GeoJSON à la carte
    L.geoJson(data1).addTo(myMap);
  })
  .catch(error => {
    console.error('Erreur lors de la récupération des données :', error);
  });

//Données en fonction du zoom 

myMap.on('zoomend', function () {
    if (myMap.getZoom() < 9.5) {
        if (!myMap.hasLayer(CartoDB_PositronOnlyLabels)) {
            myMap.addLayer(CartoDB_PositronOnlyLabels);
        }
    } else {
        if (myMap.hasLayer(CartoDB_PositronOnlyLabels)) {
            myMap.removeLayer(CartoDB_PositronOnlyLabels);
        }
    }
});
