import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { ObjectItem, ContactPerson, ObjectDocument, WorkEntry, ObjectGroup } from '@/types';
import { useDatabase } from './DatabaseProvider';
import { generateId } from '@/lib/utils';
import { deleteFilesFromUnifiedDir } from '@/lib/fileManager';

interface ObjectsContextType {
  objects: ObjectItem[];
  groups: ObjectGroup[];
  isLoading: boolean;
  addObject: (name: string, address: string, groupId?: string) => Promise<ObjectItem>;
  updateObject: (id: string, updates: Partial<ObjectItem>) => Promise<void>;
  deleteObject: (id: string) => Promise<void>;
  getObject: (id: string) => ObjectItem | undefined;
  searchObjects: (query: string) => ObjectItem[];
  
  addGroup: (name: string) => Promise<ObjectGroup>;
  updateGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  moveObjectToGroup: (objectId: string, groupId: string | null) => Promise<void>;

  updateObjectSystems: (objectId: string, systems: string[]) => Promise<void>;
  
  contacts: Record<string, ContactPerson[]>;
  addContact: (objectId: string, contact: Omit<ContactPerson, 'id' | 'objectId' | 'createdAt'>) => Promise<void>;
  updateContact: (contactId: string, updates: Partial<ContactPerson>) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  getContactsByObject: (objectId: string) => ContactPerson[];
  
  documents: Record<string, ObjectDocument[]>;
  addDocument: (objectId: string, document: Omit<ObjectDocument, 'id' | 'objectId'>) => Promise<void>;
  updateDocument: (documentId: string, updates: Partial<ObjectDocument>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentsByObject: (objectId: string) => ObjectDocument[];
  
  workEntries: Record<string, WorkEntry[]>;
  addWorkEntry: (objectId: string, entry: Omit<WorkEntry, 'id' | 'objectId' | 'createdAt'>) => Promise<void>;
  updateWorkEntry: (entryId: string, updates: Partial<WorkEntry>) => Promise<void>;
  deleteWorkEntry: (entryId: string) => Promise<void>;
  getWorkEntry: (entryId: string) => WorkEntry | undefined;
  getWorkEntriesByObject: (objectId: string) => WorkEntry[];
  
  refreshData: () => Promise<void>;
}

export const [ObjectsProvider, useObjects] = createContextHook<ObjectsContextType>(() => {
  const { db, isReady } = useDatabase();
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [groups, setGroups] = useState<ObjectGroup[]>([]);
  const [contacts, setContacts] = useState<Record<string, ContactPerson[]>>({});
  const [documents, setDocuments] = useState<Record<string, ObjectDocument[]>>({});
  const [workEntries, setWorkEntries] = useState<Record<string, WorkEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    if (!db) return;
    const result = await db.getAllAsync<ObjectGroup>(
      `SELECT id, name, created_at as createdAt FROM object_groups ORDER BY name`
    );
    setGroups(result);
  }, [db]);

  const loadObjects = useCallback(async () => {
    if (!db) return;
    const result = await db.getAllAsync<any>(
      `SELECT id, name, address, group_id as groupId, systems, created_at as createdAt, updated_at as updatedAt, sync_status as syncStatus 
       FROM objects ORDER BY updated_at DESC`
    );
    const parsed: ObjectItem[] = result.map((row: any) => ({
      ...row,
      groupId: row.groupId || undefined,
      systems: row.systems ? JSON.parse(row.systems) : [],
    }));
    setObjects(parsed);
  }, [db]);

  const loadContacts = useCallback(async () => {
    if (!db) return;
    const result = await db.getAllAsync<ContactPerson>(
      `SELECT id, object_id as objectId, full_name as fullName, position, phone, email, created_at as createdAt 
       FROM contacts ORDER BY created_at`
    );
    const grouped: Record<string, ContactPerson[]> = {};
    result.forEach(contact => {
      if (!grouped[contact.objectId]) grouped[contact.objectId] = [];
      grouped[contact.objectId].push(contact);
    });
    setContacts(grouped);
  }, [db]);

  const loadDocuments = useCallback(async () => {
    if (!db) return;
    const result = await db.getAllAsync<ObjectDocument>(
      `SELECT id, object_id as objectId, name, file_path as filePath, file_url as fileUrl, file_size as fileSize, uploaded_at as uploadedAt 
       FROM object_documents ORDER BY uploaded_at DESC`
    );
    const grouped: Record<string, ObjectDocument[]> = {};
    result.forEach(doc => {
      if (!grouped[doc.objectId]) grouped[doc.objectId] = [];
      grouped[doc.objectId].push(doc);
    });
    setDocuments(grouped);
  }, [db]);

  const loadWorkEntries = useCallback(async () => {
    if (!db) return;
    const result = await db.getAllAsync<any>(
      `SELECT id, object_id as objectId, description, photos, attached_pdf_id as attachedPdfId, 
       used_materials as usedMaterials, system_name as systemName, latitude, longitude, created_at as createdAt, sync_status as syncStatus 
       FROM work_entries ORDER BY created_at DESC`
    );
    const parsed: WorkEntry[] = result.map((row: any) => ({
      ...row,
      photos: row.photos ? JSON.parse(row.photos) : [],
      usedMaterials: row.usedMaterials ? JSON.parse(row.usedMaterials) : [],
      systemName: row.systemName || undefined,
    }));
    const grouped: Record<string, WorkEntry[]> = {};
    parsed.forEach(entry => {
      if (!grouped[entry.objectId]) grouped[entry.objectId] = [];
      grouped[entry.objectId].push(entry);
    });
    setWorkEntries(grouped);
  }, [db]);

  const refreshData = useCallback(async () => {
    if (!db) {
      console.log('[ObjectsProvider] db is null, skipping refresh');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      console.log('[ObjectsProvider] Loading data...');
      await Promise.all([loadGroups(), loadObjects(), loadContacts(), loadDocuments(), loadWorkEntries()]);
      console.log('[ObjectsProvider] Data loaded successfully');
    } catch (error) {
      console.error('[ObjectsProvider] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [db, loadGroups, loadObjects, loadContacts, loadDocuments, loadWorkEntries]);

  useEffect(() => {
    if (isReady) {
      void refreshData();
    }
  }, [isReady, refreshData]);

  const addGroup = useCallback(async (name: string): Promise<ObjectGroup> => {
    if (!db) throw new Error('Database not ready');
    const id = generateId();
    const now = Date.now();
    await db.runAsync(
      'INSERT INTO object_groups (id, name, created_at) VALUES (?, ?, ?)',
      [id, name, now]
    );
    const group: ObjectGroup = { id, name, createdAt: now };
    await loadGroups();
    return group;
  }, [db, loadGroups]);

  const updateGroup = useCallback(async (id: string, name: string) => {
    if (!db) throw new Error('Database not ready');
    await db.runAsync('UPDATE object_groups SET name = ? WHERE id = ?', [name, id]);
    await loadGroups();
  }, [db, loadGroups]);

  const deleteGroup = useCallback(async (id: string) => {
    if (!db) throw new Error('Database not ready');
    await db.runAsync('UPDATE objects SET group_id = NULL WHERE group_id = ?', [id]);
    await db.runAsync('DELETE FROM object_groups WHERE id = ?', [id]);
    await Promise.all([loadGroups(), loadObjects()]);
  }, [db, loadGroups, loadObjects]);

  const moveObjectToGroup = useCallback(async (objectId: string, groupId: string | null) => {
    if (!db) throw new Error('Database not ready');
    await db.runAsync(
      'UPDATE objects SET group_id = ?, updated_at = ? WHERE id = ?',
      [groupId, Date.now(), objectId]
    );
    await loadObjects();
  }, [db, loadObjects]);

  const updateObjectSystems = useCallback(async (objectId: string, systems: string[]) => {
    if (!db) throw new Error('Database not ready');
    await db.runAsync(
      'UPDATE objects SET systems = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(systems), Date.now(), objectId]
    );
    await loadObjects();
  }, [db, loadObjects]);

  const addObject = useCallback(async (name: string, address: string, groupId?: string): Promise<ObjectItem> => {
    if (!db) throw new Error('Database not ready');
    const id = generateId();
    const now = Date.now();
    const newObject: ObjectItem = {
      id, name, address, groupId, systems: [],
      createdAt: now, updatedAt: now, syncStatus: 'pending',
    };
    await db.runAsync(
      'INSERT INTO objects (id, name, address, group_id, systems, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, address, groupId || null, '[]', now, now, 'pending']
    );
    await loadObjects();
    return newObject;
  }, [db, loadObjects]);

  const updateObject = useCallback(async (id: string, updates: Partial<ObjectItem>) => {
    if (!db) throw new Error('Database not ready');
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.address !== undefined) { sets.push('address = ?'); values.push(updates.address); }
    if (updates.groupId !== undefined) { sets.push('group_id = ?'); values.push(updates.groupId || null); }
    if (updates.systems !== undefined) { sets.push('systems = ?'); values.push(JSON.stringify(updates.systems)); }
    sets.push('updated_at = ?'); values.push(Date.now());
    sets.push('sync_status = ?'); values.push('pending');
    values.push(id);
    await db.runAsync(`UPDATE objects SET ${sets.join(', ')} WHERE id = ?`, values);
    await loadObjects();
  }, [db, loadObjects]);

  const deleteObject = useCallback(async (id: string) => {
    if (!db) throw new Error('Database not ready');

    const filesToDelete: string[] = [];

    const docs = await db.getAllAsync<{ file_path: string | null }>(
      'SELECT file_path FROM object_documents WHERE object_id = ?', [id]
    );
    for (const doc of docs) {
      if (doc.file_path) filesToDelete.push(doc.file_path);
    }

    const entries = await db.getAllAsync<{ photos: string | null }>(
      'SELECT photos FROM work_entries WHERE object_id = ?', [id]
    );
    for (const entry of entries) {
      if (entry.photos) {
        try {
          const photos: string[] = JSON.parse(entry.photos);
          if (Array.isArray(photos)) filesToDelete.push(...photos);
        } catch {}
      }
    }

    console.log('[ObjectsProvider] deleteObject', id, '- files to delete:', filesToDelete.length);
    await deleteFilesFromUnifiedDir(filesToDelete);

    await db.runAsync('DELETE FROM work_entries WHERE object_id = ?', [id]);
    await db.runAsync('DELETE FROM object_documents WHERE object_id = ?', [id]);
    await db.runAsync('DELETE FROM contacts WHERE object_id = ?', [id]);
    await db.runAsync('DELETE FROM objects WHERE id = ?', [id]);
    await Promise.all([loadObjects(), loadWorkEntries(), loadDocuments(), loadContacts()]);
  }, [db, loadObjects, loadWorkEntries, loadDocuments, loadContacts]);

  const getObject = useCallback((id: string) => objects.find(o => o.id === id), [objects]);
  const searchObjects = useCallback((query: string) => {
    const q = query.toLowerCase();
    return objects.filter(o => 
      o.name.toLowerCase().includes(q) || 
      o.address.toLowerCase().includes(q)
    );
  }, [objects]);

  const addContact = useCallback(async (objectId: string, contact: Omit<ContactPerson, 'id' | 'objectId' | 'createdAt'>) => {
    if (!db) throw new Error('Database not ready');
    const id = generateId();
    await db.runAsync(
      'INSERT INTO contacts (id, object_id, full_name, position, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, objectId, contact.fullName, contact.position, contact.phone, contact.email || null, Date.now()]
    );
    await loadContacts();
  }, [db, loadContacts]);

  const updateContact = useCallback(async (contactId: string, updates: Partial<ContactPerson>) => {
    if (!db) throw new Error('Database not ready');
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.fullName !== undefined) { sets.push('full_name = ?'); values.push(updates.fullName); }
    if (updates.position !== undefined) { sets.push('position = ?'); values.push(updates.position); }
    if (updates.phone !== undefined) { sets.push('phone = ?'); values.push(updates.phone); }
    if (updates.email !== undefined) { sets.push('email = ?'); values.push(updates.email); }
    values.push(contactId);
    await db.runAsync(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`, values);
    await loadContacts();
  }, [db, loadContacts]);

  const deleteContact = useCallback(async (contactId: string) => {
    if (!db) throw new Error('Database not ready');
    await db.runAsync('DELETE FROM contacts WHERE id = ?', [contactId]);
    await loadContacts();
  }, [db, loadContacts]);

  const getContactsByObject = useCallback((objectId: string) => contacts[objectId] || [], [contacts]);

  const addDocument = useCallback(async (objectId: string, document: Omit<ObjectDocument, 'id' | 'objectId'>) => {
    if (!db) throw new Error('Database not ready');
    const id = generateId();
    await db.runAsync(
      'INSERT INTO object_documents (id, object_id, name, file_path, file_size, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, objectId, document.name, document.filePath, document.fileSize, document.uploadedAt]
    );
    await loadDocuments();
  }, [db, loadDocuments]);

  const updateDocument = useCallback(async (documentId: string, updates: Partial<ObjectDocument>) => {
    if (!db) throw new Error('Database not ready');
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (sets.length === 0) return;
    values.push(documentId);
    await db.runAsync(`UPDATE object_documents SET ${sets.join(', ')} WHERE id = ?`, values);
    await loadDocuments();
  }, [db, loadDocuments]);

  const deleteDocument = useCallback(async (documentId: string) => {
    if (!db) throw new Error('Database not ready');

    const doc = await db.getFirstAsync<{ file_path: string | null }>(
      'SELECT file_path FROM object_documents WHERE id = ?', [documentId]
    );
    if (doc?.file_path) {
      console.log('[ObjectsProvider] deleteDocument', documentId, '- deleting file:', doc.file_path);
      await deleteFilesFromUnifiedDir([doc.file_path]);
    }

    await db.runAsync('DELETE FROM object_documents WHERE id = ?', [documentId]);
    await loadDocuments();
  }, [db, loadDocuments]);

  const getDocumentsByObject = useCallback((objectId: string) => documents[objectId] || [], [documents]);

  const addWorkEntry = useCallback(async (objectId: string, entry: Omit<WorkEntry, 'id' | 'objectId' | 'createdAt'>) => {
    if (!db) throw new Error('Database not ready');
    const id = generateId();
    const now = Date.now();
    const photosJson = JSON.stringify(entry.photos ?? []);
    const materialsJson = JSON.stringify(entry.usedMaterials ?? []);
    const pdfId = entry.attachedPdfId ?? null;
    const systemName = entry.systemName ?? null;
    const lat = entry.latitude ?? null;
    const lon = entry.longitude ?? null;
    console.log('[ObjectsProvider] addWorkEntry params:', { id, objectId, descLen: entry.description.length, photosJson, pdfId, materialsJson, systemName, lat, lon, now });
    await db.runAsync(
      `INSERT INTO work_entries (id, object_id, description, photos, attached_pdf_id, used_materials, system_name, latitude, longitude, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, objectId, entry.description, photosJson, pdfId, materialsJson, systemName, lat, lon, now, 'pending']
    );
    console.log('[ObjectsProvider] addWorkEntry success');
    await loadWorkEntries();
  }, [db, loadWorkEntries]);

  const updateWorkEntry = useCallback(async (entryId: string, updates: Partial<WorkEntry>) => {
    if (!db) throw new Error('Database not ready');
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.photos !== undefined) { sets.push('photos = ?'); values.push(JSON.stringify(updates.photos)); }
    if (updates.attachedPdfId !== undefined) { sets.push('attached_pdf_id = ?'); values.push(updates.attachedPdfId || null); }
    if (updates.usedMaterials !== undefined) { sets.push('used_materials = ?'); values.push(JSON.stringify(updates.usedMaterials)); }
    if (updates.systemName !== undefined) { sets.push('system_name = ?'); values.push(updates.systemName || null); }
    if (updates.createdAt !== undefined) { sets.push('created_at = ?'); values.push(updates.createdAt); }
    sets.push('sync_status = ?'); values.push('pending');
    values.push(entryId);
    await db.runAsync(`UPDATE work_entries SET ${sets.join(', ')} WHERE id = ?`, values);
    await loadWorkEntries();
  }, [db, loadWorkEntries]);

  const deleteWorkEntry = useCallback(async (entryId: string) => {
    if (!db) throw new Error('Database not ready');

    const entry = await db.getFirstAsync<{ photos: string | null }>(
      'SELECT photos FROM work_entries WHERE id = ?', [entryId]
    );
    if (entry?.photos) {
      try {
        const photos: string[] = JSON.parse(entry.photos);
        if (Array.isArray(photos) && photos.length > 0) {
          console.log('[ObjectsProvider] deleteWorkEntry', entryId, '- deleting photos:', photos.length);
          await deleteFilesFromUnifiedDir(photos);
        }
      } catch {}
    }

    await db.runAsync('DELETE FROM work_entries WHERE id = ?', [entryId]);
    await loadWorkEntries();
  }, [db, loadWorkEntries]);

  const getWorkEntry = useCallback((entryId: string): WorkEntry | undefined => {
    for (const entries of Object.values(workEntries)) {
      const found = entries.find(e => e.id === entryId);
      if (found) return found;
    }
    return undefined;
  }, [workEntries]);

  const getWorkEntriesByObject = useCallback((objectId: string) => workEntries[objectId] || [], [workEntries]);

  return useMemo(() => ({
    objects, groups, isLoading,
    addObject, updateObject, deleteObject, getObject, searchObjects,
    addGroup, updateGroup, deleteGroup, moveObjectToGroup, updateObjectSystems,
    contacts, addContact, updateContact, deleteContact, getContactsByObject,
    documents, addDocument, updateDocument, deleteDocument, getDocumentsByObject,
    workEntries, addWorkEntry, updateWorkEntry, deleteWorkEntry, getWorkEntry, getWorkEntriesByObject,
    refreshData,
  }), [
    objects, groups, isLoading,
    addObject, updateObject, deleteObject, getObject, searchObjects,
    addGroup, updateGroup, deleteGroup, moveObjectToGroup, updateObjectSystems,
    contacts, addContact, updateContact, deleteContact, getContactsByObject,
    documents, addDocument, updateDocument, deleteDocument, getDocumentsByObject,
    workEntries, addWorkEntry, updateWorkEntry, deleteWorkEntry, getWorkEntry, getWorkEntriesByObject,
    refreshData,
  ]);
});
