// //Flux

// var Stadia_StamenTerrainBackground = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.{ext}', {
// 	minZoom: 0,
// 	maxZoom: 18,
// 	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
// 	ext: 'png'
// });

// var CartoDB_PositronOnlyLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
// 	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
// 	subdomains: 'abcd',
// 	maxZoom: 20
// });

// var PlanIGN = L.tileLayer('https://data.geopf.fr/wmts?'+
//     '&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM'+
//     '&LAYER={ignLayer}&STYLE={style}&FORMAT={format}'+
//     '&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}',
//     {
//         ignLayer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
//         style: 'normal',
//         format: 'image/png',
//         service: 'WMTS',
//         attribution: 'Carte © IGN/Geoplateforme'
// });


// // Initialisation de la carte
// var myMap = L.map('map', {
//     center: [47, 1],
//     zoom: 5,
//     layers: [PlanIGN]
// });


// var url_data = 'https://clmtmqz.github.io/projet/data/marins_1764_WGS84.geojson';

// // Utilisation de fetch pour récupérer le fichier GeoJSON
// fetch(url_data)
//   .then(response => {
//     // Vérifier si la réponse est correcte (code HTTP 200)
//     if (!response.ok) {
//       throw new Error('Erreur réseau : ' + response.statusText);
//     }
//     return response.json(); // Convertir la réponse en JSON
//   })
//   .then(data1 => {
//     // Ajouter la couche GeoJSON à la carte
//     L.geoJson(data1).addTo(myMap);
//   })
//   .catch(error => {
//     console.error('Erreur lors de la récupération des données :', error);
//   });

// //Données en fonction du zoom 

// myMap.on('zoomend', function () {
//     if (myMap.getZoom() < 9.5) {
//         if (!myMap.hasLayer(CartoDB_PositronOnlyLabels)) {
//             myMap.addLayer(CartoDB_PositronOnlyLabels);
//         }
//     } else {
//         if (myMap.hasLayer(CartoDB_PositronOnlyLabels)) {
//             myMap.removeLayer(CartoDB_PositronOnlyLabels);
//         }
//     }
// });
// Configuration et variables globales
const CONFIG = {
    SAINT_CHAMAS_COORDS: [43.5471, 5.0378],
    FRANCE_BOUNDS: [[41.333, -5.225], [51.124, 9.662]],
    ZOOM_THRESHOLDS: {
        DETAIL: 12,
        MEDIUM: 9,
        OVERVIEW: 6
    }
};

// Variables globales
let map;
let markersLayer;
let rasterLayer;
let buildingsLayer;
let clusterPopup;
let currentZoom = 6;

// Données simulées (à remplacer par vos vraies données)
const mockData = {
    individuals: [
        {id: 1, lat: 43.5471, lng: 5.0378, name: "Pierre Martin", type: "marin"},
        {id: 2, lat: 43.5480, lng: 5.0390, name: "Jean Dupont", type: "capitaine"},
        {id: 3, lat: 43.5460, lng: 5.0360, name: "Marie Leclerc", type: "famille"},
        {id: 4, lat: 43.2965, lng: 5.3698, name: "Paul Marseille", type: "marin"},
        {id: 5, lat: 48.8566, lng: 2.3522, name: "Louis Paris", type: "capitaine"},
        {id: 6, lat: 45.7640, lng: 4.8357, name: "Antoine Lyon", type: "marin"},
        {id: 7, lat: 47.2184, lng: -1.5536, name: "François Nantes", type: "capitaine"},
        {id: 8, lat: 49.4944, lng: 0.1079, name: "Henri Le Havre", type: "marin"}
    ]
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadDefaultData();
});

// Initialisation de la carte
function initializeMap() {
    map = L.map('map').setView([46.603354, 1.888334], 6);
    
    // Couche de base OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Initialisation des couches
    markersLayer = L.layerGroup();
    rasterLayer = L.layerGroup();
    buildingsLayer = L.layerGroup();
    
    // Ajouter la couche des marqueurs par défaut
    markersLayer.addTo(map);
    
    // Événements de la carte
    map.on('zoomend', handleZoomChange);
    map.on('moveend', updateVisibleLayers);
    
    // Popup cluster
    clusterPopup = document.getElementById('cluster-popup');
}

// Configuration des événements
function setupEventListeners() {
    // Contrôles des couches
    document.getElementById('markers-toggle').addEventListener('change', toggleMarkers);
    document.getElementById('raster-toggle').addEventListener('change', toggleRaster);
    document.getElementById('buildings-toggle').addEventListener('change', toggleBuildings);
    
    // Bouton Saint-Chamas
    document.getElementById('saint-chamas-btn').addEventListener('click', focusOnSaintChamas);
    
    // Fermeture du popup
    document.querySelector('.close-popup').addEventListener('click', closeClusterPopup);
    
    // Fermeture du popup en cliquant à l'extérieur
    clusterPopup.addEventListener('click', function(e) {
        if (e.target === clusterPopup) {
            closeClusterPopup();
        }
    });
}

// Chargement des données par défaut
function loadDefaultData() {
    loadMarkers();
    updateZoomInfo();
}

// Gestion des marqueurs
function loadMarkers() {
    markersLayer.clearLayers();
    
    const zoom = map.getZoom();
    
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL) {
        // Zoom détaillé : afficher tous les marqueurs individuels
        mockData.individuals.forEach(individual => {
            const marker = L.marker([individual.lat, individual.lng])
                .bindPopup(`
                    <strong>${individual.name}</strong><br>
                    Type: ${individual.type}<br>
                    ID: ${individual.id}
                `);
            markersLayer.addLayer(marker);
        });
    } else if (zoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM) {
        // Zoom moyen : grouper les marqueurs proches
        const clusters = clusterNearbyMarkers(mockData.individuals, 0.01);
        clusters.forEach(cluster => {
            const marker = L.marker([cluster.lat, cluster.lng], {
                icon: createClusterIcon(cluster.count)
            });
            
            marker.on('click', () => showClusterPopup(cluster));
            markersLayer.addLayer(marker);
        });
    } else {
        // Zoom global : grouper par région
        const regionalClusters = clusterByRegion(mockData.individuals);
        regionalClusters.forEach(cluster => {
            const marker = L.marker([cluster.lat, cluster.lng], {
                icon: createClusterIcon(cluster.count, 'large')
            });
            
            marker.on('click', () => showClusterPopup(cluster));
            markersLayer.addLayer(marker);
        });
    }
}

// Clustering des marqueurs proches
function clusterNearbyMarkers(individuals, threshold) {
    const clusters = [];
    const processed = new Set();
    
    individuals.forEach((individual, index) => {
        if (processed.has(index)) return;
        
        const cluster = {
            lat: individual.lat,
            lng: individual.lng,
            count: 1,
            individuals: [individual]
        };
        
        processed.add(index);
        
        // Trouver les individus proches
        individuals.forEach((other, otherIndex) => {
            if (processed.has(otherIndex)) return;
            
            const distance = Math.sqrt(
                Math.pow(individual.lat - other.lat, 2) + 
                Math.pow(individual.lng - other.lng, 2)
            );
            
            if (distance < threshold) {
                cluster.individuals.push(other);
                cluster.count++;
                processed.add(otherIndex);
            }
        });
        
        clusters.push(cluster);
    });
    
    return clusters;
}

// Clustering par région
function clusterByRegion(individuals) {
    const regions = {
        'Provence': { lat: 43.5, lng: 5.0, individuals: [] },
        'Île-de-France': { lat: 48.8, lng: 2.3, individuals: [] },
        'Rhône-Alpes': { lat: 45.7, lng: 4.8, individuals: [] },
        'Pays de la Loire': { lat: 47.2, lng: -1.5, individuals: [] },
        'Normandie': { lat: 49.4, lng: 0.1, individuals: [] }
    };
    
    individuals.forEach(individual => {
        // Logique simple pour assigner à une région
        let closestRegion = 'Provence';
        let minDistance = Infinity;
        
        Object.entries(regions).forEach(([name, region]) => {
            const distance = Math.sqrt(
                Math.pow(individual.lat - region.lat, 2) + 
                Math.pow(individual.lng - region.lng, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestRegion = name;
            }
        });
        
        regions[closestRegion].individuals.push(individual);
    });
    
    return Object.values(regions)
        .filter(region => region.individuals.length > 0)
        .map(region => ({
            lat: region.lat,
            lng: region.lng,
            count: region.individuals.length,
            individuals: region.individuals,
            isRegional: true
        }));
}

// Création d'icônes pour les clusters
function createClusterIcon(count, size = 'auto') {
    let iconSize, className;
    
    if (size === 'auto') {
        if (count < 5) {
            iconSize = [30, 30];
            className = 'marker-cluster small';
        } else if (count < 10) {
            iconSize = [40, 40];
            className = 'marker-cluster medium';
        } else {
            iconSize = [50, 50];
            className = 'marker-cluster large';
        }
    } else {
        iconSize = size === 'large' ? [50, 50] : [30, 30];
        className = `marker-cluster ${size}`;
    }
    
    return L.divIcon({
        html: `<div class="${className}">${count}</div>`,
        iconSize: iconSize,
        className: 'marker-cluster-container'
    });
}

// Affichage du popup de cluster
function showClusterPopup(cluster) {
    const detailsHtml = cluster.individuals.map(individual => `
        <div style="padding: 0.5rem; border-bottom: 1px solid #eee;">
            <strong>${individual.name}</strong><br>
            <small>Type: ${individual.type} | ID: ${individual.id}</small>
        </div>
    `).join('');
    
    document.getElementById('cluster-count').textContent = 
        `${cluster.count} entité${cluster.count > 1 ? 's' : ''} dans cette zone`;
    
    document.getElementById('cluster-details').innerHTML = detailsHtml;
    
    clusterPopup.classList.remove('hidden');
}

// Fermeture du popup
function closeClusterPopup() {
    clusterPopup.classList.add('hidden');
}

// Gestion du changement de zoom
function handleZoomChange() {
    const newZoom = map.getZoom();
    
    if (Math.abs(newZoom - currentZoom) >= 1) {
        currentZoom = newZoom;
        
        // Recharger les marqueurs selon le nouveau zoom
        if (document.getElementById('markers-toggle').checked) {
            loadMarkers();
        }
        
        // Gérer les couches selon le zoom
        updateLayerVisibility();
    }
    
    updateZoomInfo();
}

// Mise à jour de la visibilité des couches
function updateLayerVisibility() {
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Vérifier si on est sur Saint-Chamas
    const saintChamasVisible = bounds.contains(CONFIG.SAINT_CHAMAS_COORDS);
    
    // Raster et bâtiments seulement si zoom élevé et sur Saint-Chamas
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL && saintChamasVisible) {
        if (document.getElementById('raster-toggle').checked) {
            loadRasterLayer();
        }
        if (document.getElementById('buildings-toggle').checked) {
            loadBuildingsLayer();
        }
    } else {
        // Supprimer les couches si zoom trop faible
        rasterLayer.clearLayers();
        buildingsLayer.clearLayers();
    }
}

// Chargement de la couche raster
function loadRasterLayer() {
    rasterLayer.clearLayers();
    
    // Exemple de couche raster pour Saint-Chamas
    const rasterBounds = [
        [43.540, 5.030],
        [43.555, 5.045]
    ];
    
    // Simulation d'une couche raster
    const rasterOverlay = L.rectangle(rasterBounds, {
        color: 'blue',
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.3
    }).bindPopup('Couche raster - Zone d\'étude');
    
    rasterLayer.addLayer(rasterOverlay);
}

// Chargement de la couche bâtiments
function loadBuildingsLayer() {
    buildingsLayer.clearLayers();
    
    // Simulation de bâtiments pour Saint-Chamas
    const buildings = [
        { lat: 43.5471, lng: 5.0378, name: "Église" },
        { lat: 43.5475, lng: 5.0385, name: "Mairie" },
        { lat: 43.5465, lng: 5.0370, name: "Port" },
        { lat: 43.5480, lng: 5.0390, name: "Marché" }
    ];
    
    buildings.forEach(building => {
        const buildingPolygon = L.polygon([
            [building.lat - 0.0005, building.lng - 0.0005],
            [building.lat + 0.0005, building.lng - 0.0005],
            [building.lat + 0.0005, building.lng + 0.0005],
            [building.lat - 0.0005, building.lng + 0.0005]
        ], {
            color: 'red',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.5
        }).bindPopup(`Bâtiment: ${building.name}`);
        
        buildingsLayer.addLayer(buildingPolygon);
    });
}

// Basculement des couches
function toggleMarkers() {
    const isChecked = document.getElementById('markers-toggle').checked;
    
    if (isChecked) {
        map.addLayer(markersLayer);
        loadMarkers();
    } else {
        map.removeLayer(markersLayer);
    }
    
    updateZoomInfo();
}

function toggleRaster() {
    const isChecked = document.getElementById('raster-toggle').checked;
    
    if (isChecked) {
        map.addLayer(rasterLayer);
        updateLayerVisibility();
    } else {
        map.removeLayer(rasterLayer);
    }
    
    updateZoomInfo();
}

function toggleBuildings() {
    const isChecked = document.getElementById('buildings-toggle').checked;
    
    if (isChecked) {
        map.addLayer(buildingsLayer);
        updateLayerVisibility();
    } else {
        map.removeLayer(buildingsLayer);
    }
    
    updateZoomInfo();
}

// Focus sur Saint-Chamas
function focusOnSaintChamas() {
    map.setView(CONFIG.SAINT_CHAMAS_COORDS, CONFIG.ZOOM_THRESHOLDS.DETAIL);
    
    // Activer automatiquement les couches détaillées
    setTimeout(() => {
        document.getElementById('raster-toggle').checked = true;
        document.getElementById('buildings-toggle').checked = true;
        
        toggleRaster();
        toggleBuildings();
    }, 500);
}

// Mise à jour des informations de zoom
function updateZoomInfo() {
    document.getElementById('zoom-level').textContent = `Zoom: ${map.getZoom()}`;
    
    const activeLayers = [];
    if (map.hasLayer(markersLayer)) activeLayers.push('Marqueurs');
    if (map.hasLayer(rasterLayer)) activeLayers.push('Raster');
    if (map.hasLayer(buildingsLayer)) activeLayers.push('Bâtiments');
    
    document.getElementById('visible-layers').textContent = 
        `Couches: ${activeLayers.join(', ') || 'Aucune'}`;
}

// Mise à jour des couches visibles
function updateVisibleLayers() {
    updateLayerVisibility();
    updateZoomInfo();
}

// Gestion des erreurs
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Erreur JavaScript:', {
        message: msg,
        source: url,
        line: lineNo,
        column: columnNo,
        error: error
    });
    return false;
};

// Export pour usage externe si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        initializeMap,
        focusOnSaintChamas
    };
}