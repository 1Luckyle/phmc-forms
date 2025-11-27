import React from 'react';

const AdminActions = ({ formData, setFormData, showNotification, commitInfo }) => {
    return (
        <div>
            <h4>Actions Admin</h4>
            <p>Vous pouvez effectuer des actions administratives ici.</p>
            {/* Example of using a prop */}
            <p>SHA du commit actuel : {commitInfo?.sha || 'N/A'}</p>
        </div>
    );
};

export default AdminActions;
