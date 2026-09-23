import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { buildGtawAuthUrl } from '../../utils/gtawOAuth';

const GtaLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            navigate('/admin');
        }
    }, [user, navigate]);

    // Reprise après une redirection OAuth GTA World : ne s'applique que si la
    // connexion a échoué (le succès connecte déjà directement via GtaCallback,
    // qui renvoie ensuite vers /admin où ProtectedRoute laisse passer).
    useEffect(() => {
        try {
            const resultRaw = sessionStorage.getItem('gtaw-login-result');
            if (resultRaw) {
                sessionStorage.removeItem('gtaw-login-result');
                const result = JSON.parse(resultRaw);
                if (result.error) {
                    setError(`Échec de la connexion avec GTA World : ${result.error}`);
                }
            }
        } catch (err) {
            console.warn('Failed to parse GTA World login result:', err);
        }
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                setError(error.message);
            });
    };

    const handleGtawLogin = () => {
        try {
            window.location.href = buildGtawAuthUrl({ type: 'admin-login' });
        } catch (err) {
            console.error('Failed to start GTA World login:', err);
            setError('Impossible de démarrer la connexion avec GTA World.');
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: 'auto', paddingTop: '50px' }}>
            <form onSubmit={handleLogin}>
                <button type="button" onClick={() => navigate('/')} style={{ width: '25%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'pink', marginTop: '10px' }}>Accueil</button>
                <h2>Connexion</h2>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <button
                    type="button"
                    onClick={handleGtawLogin}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        width: '100%', padding: '10px', marginBottom: '15px',
                        backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #ff8c00'
                    }}
                >
                    Se connecter avec GTA World
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#ccc' }}></div>
                    <span style={{ fontSize: '0.85em' }}>ou</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#ccc' }}></div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Mot de passe</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: 'blue', color: 'white', border: 'none' }}>Connexion</button>
                </div>
                <button type="button" onClick={() => navigate('/')} style={{ width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', marginTop: '10px' }}>Accueil</button>
            </form>
        </div>
    );
};

export default GtaLogin;
