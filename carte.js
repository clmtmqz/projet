//Flux

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

var cassini = L.tileLayer('https://data.geopf.fr/wmts?'+
    '&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM'+
    '&LAYER={ignLayer}&STYLE={style}&FORMAT={format}'+
    '&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}',
    {
        ignLayer: 'GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR40',
        style: 'normal',
        format: 'image/jpeg',
        service: 'WMTS',
        attribution: 'Carte © IGN/Geoplateforme'
});

// Ma carte
var myMap = L.map('map', {
    center: [20, 1],
    zoom: 3,
    layers: [PlanIGN]
})

//Récupération des points d'intérêt et lien dynamique vers Remonter le temps (IGN)
var convsens = {
    "vSlider": "split-h",
    "hSlider": "split-v",
  }
  
var convfond = {
     "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2": "1",
     "GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN50.1950": "7",
     "GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR40": "8",
     "BNF-IGNF_GEOGRAPHICALGRIDSYSTEMS.CASSINI": "9",
     "ORTHOIMAGERY.ORTHOPHOTOS": "10",
     "ORTHOIMAGERY.ORTHOPHOTOS2011-2015": "16",
     "ORTHOIMAGERY.ORTHOPHOTOS2006-2010": "17",
     "ORTHOIMAGERY.ORTHOPHOTOS2000-2005": "18",
     "ORTHOIMAGERY.ORTHOPHOTOS.1950-1965": "19",
  }


  
fetch("data/poi_rlt.json")
.then(r => r.json())
.then(data => {
    var layer = L.geoJSON(data).bindPopup(function (data) {
        return  `
        <p>Commune : ${data.feature.properties.commune}</p>
        <p>Département : ${data.feature.properties.departement}</p>
        <p>Description : ${data.feature.properties.accroche}</p>
        <p>Thème : ${data.feature.properties.theme}</p>
        <p>Explication : ${data.feature.properties.text}</p>
        <p>Remonter le temps - IGN : <a href= "https://remonterletemps.ign.fr/comparer/?lon=${data.feature.geometry.coordinates[0]}&lat=${data.feature.geometry.coordinates[1]}&z=${data.feature.properties.zoom}&layer1=${convfond[data.feature.properties.layer1]}&layer2=${convfond[data.feature.properties.layer2]}&mode=${convsens[data.feature.properties.mode]}">Voir plus</a></p>
    `   
    });

    layer.addTo(myMap );
});





