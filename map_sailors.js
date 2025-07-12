

// Configuration et variables globales
const CONFIG = {
    SAINT_CHAMAS_COORDS: [43.5471, 5.0378],
    FRANCE_BOUNDS: [[41.333, -5.225], [51.124, 9.662]],
    ZOOM_THRESHOLDS: {
        DETAIL: 15,   // Marqueurs individuels à partir du zoom 15
        MEDIUM: 8,    // Clusters 1km à partir du zoom 8
        OVERVIEW: 6   // Clusters 60km jusqu'au zoom 7
    },
    CLUSTER_RADIUS: {
        OVERVIEW: 60, // 60 km de rayon pour zoom <= 7
        MEDIUM: 1     // 1 km de rayon pour zoom 8-14
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

// Fonction utilitaire pour calculer la distance entre deux points (en km)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en kilomètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

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
        // Zoom très détaillé (15+) : afficher tous les marqueurs individuels
        L.geoJSON(marinsData, {
            filter: function(feature) {
                // Filtrer les features avec géométrie valide
                return feature && 
                       feature.geometry && 
                       feature.geometry.coordinates && 
                       Array.isArray(feature.geometry.coordinates) &&
                       feature.geometry.coordinates.length >= 2 &&
                       typeof feature.geometry.coordinates[0] === 'number' &&
                       typeof feature.geometry.coordinates[1] === 'number';
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties || {};
                const popupContent = `
                    <strong>${props.Prenom || 'N/A'} ${props.Nom || 'N/A'}</strong><br>
                    Residence (1764): ${props.Domicile_1764 || 'N/A'}<br>
                    Precise address: ${props.Domicile_precis_1764 || 'N/A'}
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(markersLayer);
    } else {
        // Zoom 6-14 : créer des clusters avec rayons appropriés
        createClustersWithRadius();
    }
}

// Nouvelle fonction pour créer des clusters basés sur des rayons
function createClustersWithRadius() {
    const zoom = map.getZoom();
    let clusterRadius;
    
    // Déterminer le rayon selon le niveau de zoom
    if (zoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM) {
        clusterRadius = CONFIG.CLUSTER_RADIUS.MEDIUM; // 1 km
    } else {
        clusterRadius = CONFIG.CLUSTER_RADIUS.OVERVIEW; // 60 km
    }
    
    // Filtrer les features valides (avec géométrie et coordonnées)
    const validFeatures = marinsData.features.filter(feature => {
        return feature && 
               feature.geometry && 
               feature.geometry.coordinates && 
               Array.isArray(feature.geometry.coordinates) &&
               feature.geometry.coordinates.length >= 2 &&
               typeof feature.geometry.coordinates[0] === 'number' &&
               typeof feature.geometry.coordinates[1] === 'number';
    });
    
    if (validFeatures.length === 0) {
        console.warn('Aucune feature valide trouvée dans les données marins');
        return;
    }
    
    const clusters = [];
    const processedFeatures = new Set();
    
    validFeatures.forEach((feature, index) => {
        if (processedFeatures.has(index)) return;
        
        const [lng, lat] = feature.geometry.coordinates;
        const cluster = {
            lat: lat,
            lng: lng,
            features: [feature],
            centerLat: lat,
            centerLng: lng
        };
        
        processedFeatures.add(index);
        
        // Rechercher d'autres points dans le rayon
        validFeatures.forEach((otherFeature, otherIndex) => {
            if (processedFeatures.has(otherIndex)) return;
            
            const [otherLng, otherLat] = otherFeature.geometry.coordinates;
            const distance = calculateDistance(lat, lng, otherLat, otherLng);
            
            if (distance <= clusterRadius) {
                cluster.features.push(otherFeature);
                processedFeatures.add(otherIndex);
                
                // Recalculer le centre du cluster (moyenne des positions)
                const totalLat = cluster.features.reduce((sum, f) => sum + f.geometry.coordinates[1], 0);
                const totalLng = cluster.features.reduce((sum, f) => sum + f.geometry.coordinates[0], 0);
                cluster.centerLat = totalLat / cluster.features.length;
                cluster.centerLng = totalLng / cluster.features.length;
            }
        });
        
        clusters.push(cluster);
    });
    
    // Afficher les clusters
    clusters.forEach(cluster => {
        const count = cluster.features.length;
        let markerClass, iconSize;
        
        // Taille du marqueur selon le nombre d'éléments et le rayon
        if (clusterRadius === CONFIG.CLUSTER_RADIUS.OVERVIEW) {
            // Clusters à 60km : plus gros marqueurs
            markerClass = 'marker-cluster large';
            iconSize = Math.min(60, 30 + count * 2);
        } else {
            // Clusters à 1km : marqueurs moyens
            markerClass = 'marker-cluster medium';
            iconSize = Math.min(50, 25 + count * 1.5);
        }
        
        const marker = L.marker([cluster.centerLat, cluster.centerLng], {
            icon: L.divIcon({
                html: `<div class="${markerClass}" style="width: ${iconSize}px; height: ${iconSize}px; line-height: ${iconSize}px;">${count}</div>`,
                iconSize: [iconSize, iconSize],
                className: 'marker-cluster-container'
            })
        });
        
        marker.on('click', () => {
            showClusterPopup(cluster.features, clusterRadius);
        });
        
        markersLayer.addLayer(marker);
    });
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

// Affichage du popup de cluster avec information sur le rayon
function showClusterPopup(features, clusterRadius) {
    const detailsHtml = features.map(feature => {
        const props = feature.properties || {};
        return `
            <div style="padding: 0.5rem; border-bottom: 1px solid #eee;">
                <strong>${props.Prenom || 'N/A'} ${props.Nom || 'N/A'}</strong><br>
                <small>Domicile: ${props.Domicile_1764 || 'N/A'}</small>
            </div>
        `;
    }).join('');
    
    const radiusText = clusterRadius === CONFIG.CLUSTER_RADIUS.OVERVIEW ? '60 km' : '1 km';
    
    document.getElementById('cluster-count').textContent = 
        `${features.length} Seafarer${features.length > 1 ? 's' : ''} in ${radiusText} radius`;
    
    document.getElementById('cluster-details').innerHTML = detailsHtml;
    
    clusterPopup.classList.remove('hidden');
}

// Fermeture du popup
function closeClusterPopup() {
    clusterPopup.classList.add('hidden');
}

// Gestion du changement de zoom
function handleZoomChange() {
    const previousZoom = currentZoom;
    currentZoom = map.getZoom();
    
    // Vérifier si on a changé de seuil de clustering
    const previousClusterMode = previousZoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM ? 'medium' : 'overview';
    const currentClusterMode = currentZoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM ? 'medium' : 'overview';
    
    if (previousClusterMode !== currentClusterMode) {
        // Recalculer les clusters si on a changé de mode
        updateLayerVisibility();
    }
    
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
    map.setView(CONFIG.SAINT_CHAMAS_COORDS, 14); // Zoom 14 pour voir les clusters 1km
    
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
        const zoom = map.getZoom();
        let clusterInfo = '';
        
        if (zoom >= CONFIG.ZOOM_THRESHOLDS.DETAIL) {
            clusterInfo = ' (Individual markers)';
        } else if (zoom >= CONFIG.ZOOM_THRESHOLDS.MEDIUM) {
            clusterInfo = ' (1km clusters)';
        } else {
            clusterInfo = ' (60km clusters)';
        }
        
        zoomElement.textContent = `Zoom: ${zoom}${clusterInfo}`;
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

