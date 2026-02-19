// scripts/manage-admins.js
// Script pour gérer les administrateurs de l'application

const { database } = require('../src/firebase');
const { ref, get, set } = require('firebase/database');

const ACTION = process.argv[2]; // 'add', 'remove', 'list'
const EMAIL = process.argv[3];

async function listAdmins() {
    try {
        const adminListRef = ref(database, 'adminUsers');
        const snapshot = await get(adminListRef);
        
        if (!snapshot.exists()) {
            console.log('📋 Aucun administrateur configuré.');
            return;
        }
        
        const admins = snapshot.val();
        const adminArray = Array.isArray(admins) ? admins : Object.values(admins);
        
        console.log('\n📋 Liste des administrateurs :');
        console.log('─'.repeat(50));
        adminArray.forEach((admin, index) => {
            console.log(`${index + 1}. ${admin}`);
        });
        console.log('─'.repeat(50));
        console.log(`Total : ${adminArray.length} administrateur(s)\n`);
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des admins:', error.message);
    }
}

async function addAdmin(email) {
    if (!email) {
        console.error('❌ Veuillez fournir un email');
        console.log('Usage: node scripts/manage-admins.js add email@example.com');
        return;
    }
    
    try {
        const adminListRef = ref(database, 'adminUsers');
        const snapshot = await get(adminListRef);
        
        let admins = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            admins = Array.isArray(data) ? data : Object.values(data);
        }
        
        if (admins.includes(email)) {
            console.log(`⚠️  ${email} est déjà administrateur`);
            return;
        }
        
        admins.push(email);
        await set(adminListRef, admins);
        
        console.log(`✅ ${email} a été ajouté comme administrateur`);
        console.log(`Total : ${admins.length} administrateur(s)`);
    } catch (error) {
        console.error('❌ Erreur lors de l\'ajout:', error.message);
    }
}

async function removeAdmin(email) {
    if (!email) {
        console.error('❌ Veuillez fournir un email');
        console.log('Usage: node scripts/manage-admins.js remove email@example.com');
        return;
    }
    
    try {
        const adminListRef = ref(database, 'adminUsers');
        const snapshot = await get(adminListRef);
        
        if (!snapshot.exists()) {
            console.log('📋 Aucun administrateur configuré.');
            return;
        }
        
        const data = snapshot.val();
        let admins = Array.isArray(data) ? data : Object.values(data);
        
        const index = admins.indexOf(email);
        if (index === -1) {
            console.log(`⚠️  ${email} n'est pas dans la liste des administrateurs`);
            return;
        }
        
        admins = admins.filter(admin => admin !== email);
        await set(adminListRef, admins);
        
        console.log(`✅ ${email} a été retiré de la liste des administrateurs`);
        console.log(`Total : ${admins.length} administrateur(s)`);
    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error.message);
    }
}

async function main() {
    console.log('\n🔧 Gestionnaire d\'Administrateurs PHMC-FR\n');
    
    switch (ACTION) {
        case 'list':
            await listAdmins();
            break;
        case 'add':
            await addAdmin(EMAIL);
            break;
        case 'remove':
            await removeAdmin(EMAIL);
            break;
        default:
            console.log('Usage:');
            console.log('  node scripts/manage-admins.js list');
            console.log('  node scripts/manage-admins.js add email@example.com');
            console.log('  node scripts/manage-admins.js remove email@example.com');
            break;
    }
    
    process.exit(0);
}

main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});
