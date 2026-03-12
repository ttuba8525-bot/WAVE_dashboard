// Firebase configuration using the compat SDK (v8 API)
const firebaseConfig = {
    projectId: "wav3-dashboard", // Based on the URL provided
    databaseURL: "https://wav3-dashboard-default-rtdb.firebaseio.com"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
