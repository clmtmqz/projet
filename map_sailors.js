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

var PlanIGN = L.tileLayer('https://data.geopf.fr/wmts?'+
    '&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM'+
    '&LAYER={ignLayer}&STYLE={style}&FORMAT={format}'+
    '&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}',
    {
        ignLayer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
        style: 'normal',
        format: 'image/png',
        service: 'WMTS',
        attribution: 'Carte © IGN/Geoplateforme'
});


// Initialisation de la carte
var myMap = L.map('map', {
    center: [47, 1],
    zoom: 5,
    layers: [PlanIGN]
});


var url_data = 'https://clmtmqz.github.io/projet/data/marins_1764_WGS84.geojson';

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
