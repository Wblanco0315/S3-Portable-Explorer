import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSupabaseStore, Group } from "../features/supabase/supabaseStore";
// Wait! Let's make sure we import icons from react-icons/hi! The guideline says: "react-icons (preferably Heroicons or Remix Icons)"
import {
  HiOutlineUsers as HiUsers,
  HiOutlineUserAdd as HiUserAdd,
  HiOutlineShieldCheck as HiShieldCheck,
  HiOutlineUserRemove as HiUserRemove,
  HiOutlineCheck as HiCheck,
  HiOutlineX as HiX,
  HiOutlinePlus as HiPlus,
} from "react-icons/hi";

export default function CloudGroupsPage() {
  const { t } = useTranslation();

  // Supabase state
  const groups = useSupabaseStore((state) => state.groups);
  const groupMembers = useSupabaseStore((state) => state.groupMembers);
  const profile = useSupabaseStore((state) => state.profile);
  const isLoading = useSupabaseStore((state) => state.isLoading);

  // Actions
  const createGroup = useSupabaseStore((state) => state.createGroup);
  const fetchGroupMembers = useSupabaseStore((state) => state.fetchGroupMembers);
  const addMemberToGroup = useSupabaseStore((state) => state.addMemberToGroup);
  const updateMemberStatus = useSupabaseStore((state) => state.updateMemberStatus);
  const updateMemberRole = useSupabaseStore((state) => state.updateMemberRole);
  const removeMemberFromGroup = useSupabaseStore((state) => state.removeMemberFromGroup);

  // Local state
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>("member");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup.id);
    }
  }, [selectedGroup]);

  // Refresh active group members list if update happens
  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup.id);
    }
  }, [groupMembers[selectedGroup?.id || ""]?.length]);

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await createGroup(newGroupName.trim());
    setNewGroupName("");
    setShowCreateGroup(false);
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    if (!selectedGroup || !newMemberEmail.trim()) return;

    await addMemberToGroup(selectedGroup.id, newMemberEmail.trim().toLowerCase(), newMemberRole);
    const storeErr = useSupabaseStore.getState().error;
    if (storeErr) {
      setLocalErr(storeErr);
    } else {
      setNewMemberEmail("");
    }
  };

  const currentMembers = selectedGroup ? groupMembers[selectedGroup.id] || [] : [];
  const isSelectedGroupAdmin = selectedGroup 
    ? selectedGroup.owner_id === profile?.id || 
      currentMembers.some(m => m.user_id === profile?.id && m.role === 'admin' && m.status === 'approved')
    : false;

  return (
    <div className="flex-1 flex p-8 bg-surface-container-lowest gap-6 overflow-hidden select-none">
      {/* LEFT COLUMN: GROUPS LIST */}
      <div className="w-1/3 flex flex-col border border-outline-variant rounded-md bg-surface-container overflow-hidden">
        <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-high">
          <h2 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
            <HiUsers className="text-primary" />
            {t("cloud.groups_title")}
          </h2>
          {profile?.role !== "user" && (
            <button
              onClick={() => setShowCreateGroup(true)}
              className="p-1 text-primary hover:bg-surface-variant rounded-md transition-colors cursor-pointer"
              title={t("cloud.groups.create")}
            >
              <HiPlus size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {groups.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant text-body-sm italic">
              {t("cloud.groups.no_groups")}
            </div>
          ) : (
            groups.map((group) => {
              const isOwner = group.owner_id === profile?.id;
              const isSelected = selectedGroup?.id === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group);
                    setLocalErr(null);
                  }}
                  className={`w-full text-left p-3 rounded-sm border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary-container border-primary text-on-primary-container"
                      : "bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <div className="font-semibold text-body-sm">{group.name}</div>
                  <div className="text-[10px] font-mono opacity-80 mt-1 flex justify-between">
                    <span>{isOwner ? "Propietario" : "Miembro"}</span>
                    <span>Creado: {new Date(group.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: GROUP DETAILS & MEMBERS */}
      <div className="flex-1 flex flex-col border border-outline-variant rounded-md bg-surface-container overflow-hidden">
        {selectedGroup ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-outline-variant bg-surface-container-high flex flex-col gap-1">
              <h2 className="text-body-lg font-bold text-on-surface">{selectedGroup.name}</h2>
              <span className="text-[10px] font-mono text-on-surface-variant">
                Grupo ID: {selectedGroup.id} | Propietario: {selectedGroup.owner?.email || "Cargando..."}
              </span>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Member List */}
              <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
                <span className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">
                  Miembros ({currentMembers.length})
                </span>

                <div className="flex flex-col gap-2">
                  {currentMembers.map((member) => {
                    const memberProfile = member.profiles;
                    const name = memberProfile 
                      ? `${memberProfile.first_name} ${memberProfile.last_name}`.trim() || memberProfile.email
                      : "Cargando...";
                    const email = memberProfile ? memberProfile.email : "";
                    
                    const isSelf = member.user_id === profile?.id;
                    const isGroupOwner = selectedGroup.owner_id === member.user_id;

                    return (
                      <div
                        key={member.id}
                        className="bg-surface-container-low border border-outline-variant/30 p-3 rounded-sm flex items-center justify-between"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-body-sm font-semibold text-on-surface flex items-center gap-1.5">
                            {name}
                            {isSelf && (
                              <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono font-medium">
                                Tú
                              </span>
                            )}
                          </span>
                          <span className="text-label-sm text-on-surface-variant font-mono">{email}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Role Chip */}
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            isGroupOwner 
                              ? "bg-tertiary-container border-tertiary text-on-tertiary-container" 
                              : member.role === "admin"
                              ? "bg-primary-container border-primary text-on-primary-container"
                              : "bg-surface-container border-outline text-on-surface"
                          }`}>
                            {isGroupOwner ? "Dueño" : member.role === "admin" ? "Admin" : "Miembro"}
                          </span>

                          {/* Action Controls for Admin */}
                          {isSelectedGroupAdmin && !isGroupOwner && !isSelf && (
                            <div className="flex items-center gap-1.5">
                              {member.status === "pending" ? (
                                <>
                                  <button
                                    onClick={() => updateMemberStatus(selectedGroup.id, member.id, "approved")}
                                    className="p-1 text-tertiary hover:bg-surface-variant rounded-md cursor-pointer"
                                    title="Aprobar miembro"
                                  >
                                    <HiCheck size={16} />
                                  </button>
                                  <button
                                    onClick={() => updateMemberStatus(selectedGroup.id, member.id, "rejected")}
                                    className="p-1 text-error hover:bg-surface-variant rounded-md cursor-pointer"
                                    title="Rechazar miembro"
                                  >
                                    <HiX size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => updateMemberRole(selectedGroup.id, member.id, member.role === "admin" ? "member" : "admin")}
                                    className="p-1 text-primary hover:bg-surface-variant rounded-md cursor-pointer"
                                    title={member.role === "admin" ? "Hacer Miembro" : "Hacer Administrador"}
                                  >
                                    <HiShieldCheck size={16} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`¿Estás seguro de que deseas eliminar a ${name} del grupo?`)) {
                                        await removeMemberFromGroup(selectedGroup.id, member.user_id);
                                      }
                                    }}
                                    className="p-1 text-error hover:bg-surface-variant rounded-md cursor-pointer"
                                    title="Eliminar del grupo"
                                  >
                                    <HiUserRemove size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Member Form (Admins only) */}
              {isSelectedGroupAdmin && (
                <div className="w-80 border-l border-outline-variant/30 p-5 bg-surface-container-high flex flex-col gap-4">
                  <span className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <HiUserAdd />
                    {t("cloud.groups.add_member")}
                  </span>

                  <form onSubmit={handleAddMemberSubmit} className="flex flex-col gap-3">
                    <div>
                      <label className="text-[10px] text-on-surface-variant font-medium block mb-1">
                        {t("cloud.email")}
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="ejemplo@correo.com"
                        className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                        value={newMemberEmail}
                        onChange={(e) => {
                          setNewMemberEmail(e.target.value);
                          setLocalErr(null);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-on-surface-variant font-medium block mb-1">
                        {t("cloud.groups.role")}
                      </label>
                      <select
                        className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value as any)}
                      >
                        <option value="member">Miembro Regular</option>
                        <option value="admin">Administrador del Grupo</option>
                      </select>
                    </div>

                    {localErr && (
                      <div className="bg-error-container/20 text-error p-2.5 border border-error/30 rounded-md text-[11px] leading-relaxed">
                        {localErr}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="py-1.5 bg-primary text-on-primary text-label-sm font-semibold rounded-sm hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Añadir al Grupo
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-on-surface-variant gap-2">
            <HiUsers size={48} className="opacity-30" />
            <p className="text-body-md font-medium">Selecciona un grupo para administrar sus miembros y ver los detalles.</p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: CREATE GROUP */}
      {/* ---------------------------------------------------- */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <form onSubmit={handleCreateGroupSubmit} className="bg-surface-container border border-outline-variant max-w-sm w-full p-6 rounded-md shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-body-lg font-bold text-on-surface">{t("cloud.groups.create")}</h3>
              <button type="button" onClick={() => setShowCreateGroup(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <HiX size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant font-medium block">
                {t("cloud.groups.name")}
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Desarrollo Backend"
                className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowCreateGroup(false)}
                className="py-1.5 px-4 bg-surface-container border border-outline text-on-surface text-label-sm rounded-sm hover:bg-surface-variant cursor-pointer"
              >
                {t("cloud.cancel")}
              </button>
              <button
                type="submit"
                className="py-1.5 px-5 bg-primary text-on-primary text-label-sm rounded-sm hover:brightness-105 cursor-pointer font-semibold"
              >
                Crear
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
