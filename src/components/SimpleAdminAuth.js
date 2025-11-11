import React, { useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';

const SimpleAdminAuth = ({ onAuthSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        
        try {
            const adminRef = ref(database, `staff/admins/${username}`);
            const snapshot = await get(adminRef);
            
            if (snapshot.exists()) {
                const adminData = snapshot.val();
                
                // Vérification simple (à améliorer pour la production!)
                if (adminData.role === 'admin') {
                    localStorage.setItem('adminUser', JSON.stringify({
                        username,
                        ...adminData
                    }));
                    onAuthSuccess(adminData);
                } else {
                    setError('Access denied: Not an admin');
                }
            } else {
                setError('Invalid credentials');
            }
        } catch (err) {
            setError('Login error: ' + err.message);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2>Admin Login (Dev Mode)</h2>
                <form onSubmit={handleLogin} style={styles.form}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={styles.input}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                    />
                    <button type="submit" style={styles.button}>
                        Login as Admin
                    </button>
                    {error && <p style={styles.error}>{error}</p>}
                </form>
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0d1117'
    },
    card: {
        backgroundColor: '#161b22',
        padding: '2rem',
        borderRadius: '8px',
        border: '1px solid #30363d',
        minWidth: '300px'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
    },
    input: {
        padding: '0.5rem',
        borderRadius: '4px',
        border: '1px solid #30363d',
        backgroundColor: '#0d1117',
        color: '#c9d1d9'
    },
    button: {
        padding: '0.5rem',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: '#238636',
        color: 'white',
        cursor: 'pointer'
    },
    error: {
        color: '#f85149',
        fontSize: '0.9rem'
    }
};

export default SimpleAdminAuth;