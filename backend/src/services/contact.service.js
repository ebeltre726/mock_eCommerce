export async function sendMessage({ firstName, lastName, email, emailMessage }) {
    if (!firstName || !lastName || !email || !emailMessage) {
        throw new Error('All fields are required');
    }

    console.log('Contact message received.');
    
}