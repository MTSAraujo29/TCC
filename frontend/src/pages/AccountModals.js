import React from 'react';

function AccountModals({
                           showEditModal,
                           setShowEditModal,
                           showDeleteModal,
                           setShowDeleteModal,
                           editName,
                           setEditName,
                           editPassword,
                           setEditPassword,
                           editLoading,
                           editError,
                           deleteLoading,
                           deleteError,
                           handleEditAccount,
                           handleDeleteAccount
                       }) {
    return (
        <>
            {showEditModal && (
                <div className="modal" role="dialog" aria-modal="true" aria-labelledby="editAccountTitle">
                    <h2 id="editAccountTitle">Editar Conta</h2>

                    <form onSubmit={handleEditAccount}>
                        <label htmlFor="editName">Nome:</label>
                        <input
                            id="editName"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            required
                        />

                        <label htmlFor="editPassword">Nova Senha:</label>
                        <input
                            id="editPassword"
                            type="password"
                            value={editPassword}
                            onChange={e => setEditPassword(e.target.value)}
                            minLength={6}
                        />

                        {editError && <div className="error">{editError}</div>}

                        <button type="submit" disabled={editLoading}>
                            Salvar
                        </button>

                        <button type="button" onClick={() => setShowEditModal(false)}>
                            Cancelar
                        </button>
                    </form>
                </div>
            )}

            {showDeleteModal && (
                <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deleteAccountTitle">
                    <h2 id="deleteAccountTitle">Excluir Conta</h2>

                    <p>Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.</p>

                    {deleteError && <div className="error">{deleteError}</div>}

                    <button onClick={handleDeleteAccount} disabled={deleteLoading}>
                        Confirmar
                    </button>

                    <button onClick={() => setShowDeleteModal(false)}>
                        Cancelar
                    </button>
                </div>
            )}
        </>
    );
}

export default React.memo(AccountModals);