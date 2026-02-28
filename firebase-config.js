// Firebase Configuration
// Loads credentials from firebase-credentials.json for easy project switching

let auth, db, googleProvider;

// Load Firebase credentials from JSON file
fetch('firebase-credentials.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to load firebase-credentials.json');
        }
        return response.json();
    })
    .then(firebaseConfig => {
        // Validate required fields
        const requiredFields = ['apiKey', 'authDomain', 'projectId'];
        const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields in firebase-credentials.json: ${missingFields.join(', ')}`);
        }

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);

        // Initialize services
        auth = firebase.auth();
        db = firebase.firestore();
        record.otp = generateOTP(6);

        // Configure Google Auth Provider
        googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.setCustomParameters({
            prompt: 'select_account'
        });

        console.log(`✅ Firebase initialized for project: ${firebaseConfig.projectId}`);
        console.log('%c📚 Setup Guide', 'color: #4285F4; font-size: 16px; font-weight: bold');
        console.log('%cIf dashboard is not showing records, follow these steps:', 'color: #5f6368; font-size: 14px');
        console.log('%c1. Deploy Firestore Rules (Firebase Console → Firestore → Rules)', 'color: #202124');
        console.log('%c2. Create Firestore Index (Firebase Console → Firestore → Indexes)', 'color: #202124');
        console.log('%c📖 See FIRESTORE_QUICKSTART.md for detailed instructions', 'color: #34A853; font-weight: bold');
        
        // Dispatch event to notify that Firebase is ready
        window.dispatchEvent(new Event('firebase-ready'));
    })
    .catch(error => {
        console.error('❌ Firebase initialization failed:', error.message);
        console.error('%c⚠️ Make sure firebase-credentials.json exists and contains valid Firebase config', 'color: #EA4335; font-size: 14px; font-weight: bold');
        console.error('%c📝 Create firebase-credentials.json with your Firebase project credentials', 'color: #5f6368');
        
        // Show error in UI
        document.addEventListener('DOMContentLoaded', () => {
            document.body.innerHTML = `
                <div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
                    <h1 style="color: #EA4335;">⚠️ Firebase Configuration Error</h1>
                    <p style="color: #5f6368; font-size: 16px;">${error.message}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <h3>How to fix:</h3>
                        <ol style="color: #202124;">
                            <li>Create <code>firebase-credentials.json</code> in the public folder</li>
                            <li>Add your Firebase project credentials (get from Firebase Console → Project Settings)</li>
                            <li>Refresh this page</li>
                        </ol>
                    </div>
                    <div style="background: #e8f0fe; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <h4>Example firebase-credentials.json:</h4>
                        <pre style="background: white; padding: 10px; border-radius: 4px; overflow-x: auto;">{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.firebasestorage.app",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcdef123456"
}</pre>
                    </div>
                </div>
            `;
        });
    });
