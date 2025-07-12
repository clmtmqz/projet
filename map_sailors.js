

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
let marinsData = null;
let buildingsData = null;
let markersLayer;
let rasterLayer;
let buildingsLayer;
let clusterPopup;
let currentZoom = 6;

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

// Chargement des données marins
function loadMarinsData() {
    fetch('data/marins_1764_WGS84.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du chargement du GeoJSON marins');
            }
            return response.json();
        })
        .then(data => {
            marinsData = data;
            displayMarkers();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des marins :', error);
        });
}

// Chargement des données bâtiments
function loadBuildingsData() {
    fetch('data/building_chamas.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur lors du chargement du GeoJSON bâtiments');
            }
            return response.json();
        })
        .then(data => {
            buildingsData = data;
            displayBuildings();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des bâtiments :', error);
        });
}

// Affichage des marqueurs selon le zoom
function displayMarkers() {
    if (!marinsData || !document.getElementById('markers-toggle').checked) return;
    
    markersLayer.clearLayers();
    
    const zoom = map.getZoom();
    
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL) {
        // Zoom détaillé : afficher tous les marqueurs individuels
        L.geoJSON(marinsData, {
            onEachFeature: function (feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <strong>${props.Prenom} ${props.Nom}</strong><br>
                    Residence (1764): ${props.Domicile_1764}<br>
                    Precise address: ${props.Domicile_precis_1764}
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(markersLayer);
    } else if (zoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM) {
        // Zoom moyen : créer des clusters
        createClusters();
    } else {
        // Zoom faible : clusters régionaux
        createRegionalClusters();
    }
}

// Création de clusters pour zoom moyen
function createClusters() {
    const clusters = new Map();
    const clusterSize = 0.05; // Taille du cluster en degrés
    
    marinsData.features.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const clusterKey = `${Math.floor(lat/clusterSize)}_${Math.floor(lng/clusterSize)}`;
        
        if (!clusters.has(clusterKey)) {
            clusters.set(clusterKey, {
                lat: Math.floor(lat/clusterSize) * clusterSize + clusterSize/2,
                lng: Math.floor(lng/clusterSize) * clusterSize + clusterSize/2,
                features: []
            });
        }
        
        clusters.get(clusterKey).features.push(feature);
    });
    
    clusters.forEach(cluster => {
        const count = cluster.features.length;
        const marker = L.marker([cluster.lat, cluster.lng], {
            icon: L.divIcon({
                html: `<div class="marker-cluster medium">${count}</div>`,
                iconSize: [40, 40],
                className: 'marker-cluster-container'
            })
        });
        
        marker.on('click', () => {
            showClusterPopup(cluster.features);
        });
        
        markersLayer.addLayer(marker);
    });
}

// Création de clusters régionaux
function createRegionalClusters() {
    // Créer des clusters très larges pour la vue d'ensemble
    const marker = L.marker([46.603354, 1.888334], {
        icon: L.divIcon({
            html: `<div class="marker-cluster large">${marinsData.features.length}</div>`,
            iconSize: [50, 50],
            className: 'marker-cluster-container'
        })
    });
    
    marker.on('click', () => {
        showClusterPopup(marinsData.features);
    });
    
    markersLayer.addLayer(marker);
}

// Affichage des bâtiments
function displayBuildings() {
    if (!buildingsData || !document.getElementById('buildings-toggle').checked) return;
    
    buildingsLayer.clearLayers();
    
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Afficher seulement si zoom élevé et dans la zone Saint-Chamas
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL && bounds.contains(CONFIG.SAINT_CHAMAS_COORDS)) {
        L.geoJSON(buildingsData, {
            style: {
                color: 'red',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.5
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <strong>Building</strong><br>
                    ${props.name || props.type || 'Details not available'}
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(buildingsLayer);
    }
}

// Chargement de la couche cadastre
function loadCadastreLayer() {
    if (!document.getElementById('raster-toggle').checked) return;
    
    rasterLayer.clearLayers();
    
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Afficher seulement si zoom élevé et dans la zone Saint-Chamas
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL && bounds.contains(CONFIG.SAINT_CHAMAS_COORDS)) {
        
        // Vérifier si le fichier TIF existe
        fetch('data/saint_chamas_cadastre_1819.tif', { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    throw new Error('TIF non disponible');
                }
                return fetch('data/saint_chamas_cadastre_1819.tif');
            })
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => {
                // Nécessite la bibliothèque georaster
                if (typeof parseGeoraster !== 'undefined') {
                    return parseGeoraster(arrayBuffer);
                } else {
                    throw new Error('Bibliothèque georaster non disponible');
                }
            })
            .then(georaster => {
                // Nécessite la bibliothèque georaster-layer-for-leaflet
                if (typeof GeoRasterLayer !== 'undefined') {
                    const layer = new GeoRasterLayer({
                        georaster: georaster,
                        opacity: 0.7
                    });
                    rasterLayer.addLayer(layer);
                } else {
                    throw new Error('Bibliothèque GeoRasterLayer non disponible');
                }
            })
            .catch(error => {
                console.log('TIF non disponible, utilisation du JPEG');
                loadJpegCadastre();
            });
    }
}

// Chargement JPEG avec coordonnées
function loadJpegCadastre() {
    // Coordonnées approximatives pour Saint-Chamas
    const imageBounds = [
        [43.540, 5.030],  // Sud-Ouest
        [43.555, 5.045]   // Nord-Est
    ];
    
    const imageOverlay = L.imageOverlay('data/saint_chamas_cadastre_1819.jpg', imageBounds, {
        opacity: 0.7,
        interactive: true
    });
    
    rasterLayer.addLayer(imageOverlay);
}

// Affichage du popup de cluster
function showClusterPopup(features) {
    const detailsHtml = features.map(feature => {
        const props = feature.properties;
        return `
            <div style="padding: 0.5rem; border-bottom: 1px solid #eee;">
                <strong>${props.Prenom} ${props.Nom}</strong><br>
                <small>Domicile: ${props.Domicile_1764}</small>
            </div>
        `;
    }).join('');
    
    document.getElementById('cluster-count').textContent = 
        `${features.length} Seafarer${features.length > 1 ? 's' : ''} in this area`;
    
    document.getElementById('cluster-details').innerHTML = detailsHtml;
    
    clusterPopup.classList.remove('hidden');
}

// Fermeture du popup
function closeClusterPopup() {
    clusterPopup.classList.add('hidden');
}

// Gestion du changement de zoom
function handleZoomChange() {
    currentZoom = map.getZoom();
    updateLayerVisibility();
    updateZoomInfo();
}

// Mise à jour de la visibilité des couches
function updateLayerVisibility() {
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    
    // Rafraîchir les couches actives
    if (document.getElementById('markers-toggle').checked) {
        displayMarkers();
    }
    
    if (document.getElementById('raster-toggle').checked) {
        loadCadastreLayer();
    }
    
    if (document.getElementById('buildings-toggle').checked) {
        displayBuildings();
    }
}

// Basculement des couches
function toggleMarkers() {
    const isChecked = document.getElementById('markers-toggle').checked;
    
    if (isChecked) {
        map.addLayer(markersLayer);
        displayMarkers();
    } else {
        map.removeLayer(markersLayer);
    }
    updateZoomInfo();
}

function toggleRaster() {
    const isChecked = document.getElementById('raster-toggle').checked;
    
    if (isChecked) {
        map.addLayer(rasterLayer);
        loadCadastreLayer();
    } else {
        map.removeLayer(rasterLayer);
    }
    updateZoomInfo();
}

function toggleBuildings() {
    const isChecked = document.getElementById('buildings-toggle').checked;
    
    if (isChecked) {
        map.addLayer(buildingsLayer);
        displayBuildings();
    } else {
        map.removeLayer(buildingsLayer);
    }
    updateZoomInfo();
}

// Focus sur Saint-Chamas
function focusOnSaintChamas() {
    map.setView(CONFIG.SAINT_CHAMAS_COORDS, CONFIG.ZOOM_THRESHOLDS.DETAIL);
    
    // Activer automatiquement les couches détaillées après un délai
    setTimeout(() => {
        document.getElementById('raster-toggle').checked = true;
        document.getElementById('buildings-toggle').checked = true;
        
        toggleRaster();
        toggleBuildings();
        updateLayerVisibility();
    }, 1000);
}

// Mise à jour des informations de zoom
function updateZoomInfo() {
    const zoomElement = document.getElementById('zoom-level');
    const layersElement = document.getElementById('visible-layers');
    
    if (zoomElement) {
        zoomElement.textContent = `Zoom: ${map.getZoom()}`;
    }
    
    if (layersElement) {
        const activeLayers = [];
        if (map.hasLayer(markersLayer)) activeLayers.push('Seafarers');
        if (map.hasLayer(rasterLayer)) activeLayers.push('Cadastre');
        if (map.hasLayer(buildingsLayer)) activeLayers.push('Buildings');
        
        layersElement.textContent = 
            `Layers: ${activeLayers.join(', ') || 'None'}`;
    }
}

// Mise à jour des couches visibles
function updateVisibleLayers() {
    updateLayerVisibility();
    updateZoomInfo();
}

// Configuration des événements
function setupEventListeners() {
    // Vérifier que les éléments existent avant d'ajouter les événements
    const markersToggle = document.getElementById('markers-toggle');
    const rasterToggle = document.getElementById('raster-toggle');
    const buildingsToggle = document.getElementById('buildings-toggle');
    const saintChamasBtn = document.getElementById('saint-chamas-btn');
    const closePopup = document.querySelector('.close-popup');
    
    if (markersToggle) {
        markersToggle.addEventListener('change', toggleMarkers);
    }
    
    if (rasterToggle) {
        rasterToggle.addEventListener('change', toggleRaster);
    }
    
    if (buildingsToggle) {
        buildingsToggle.addEventListener('change', toggleBuildings);
    }
    
    if (saintChamasBtn) {
        saintChamasBtn.addEventListener('click', focusOnSaintChamas);
    }
    
    if (closePopup) {
        closePopup.addEventListener('click', closeClusterPopup);
    }
    
    // Fermeture du popup en cliquant à l'extérieur
    if (clusterPopup) {
        clusterPopup.addEventListener('click', function(e) {
            if (e.target === clusterPopup) {
                closeClusterPopup();
            }
        });
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadMarinsData();
    loadBuildingsData();
    updateZoomInfo();
});

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