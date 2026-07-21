import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, setDoc, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Real-time Firestore hook for the "customers" collection.
 * Provides CRUD operations and live data subscription.
 */
export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "customers"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ firestoreId: d.id, ...d.data() }));
        setCustomers(data);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError(err.message || "Failed to connect to Firebase");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  /** Batch-write multiple customer records to Firestore */
  const addCustomers = async (customerList) => {
    const batch = writeBatch(db);
    customerList.forEach((c) => {
      const ref = doc(collection(db, "customers"));
      batch.set(ref, c);
    });
    await batch.commit();
  };

  /** Merge-update a single customer by Firestore document ID */
  const updateCustomer = async (firestoreId, data) => {
    await setDoc(doc(db, "customers", firestoreId), data, { merge: true });
  };

  /** Delete a single customer by Firestore document ID */
  const deleteCustomer = async (firestoreId) => {
    await deleteDoc(doc(db, "customers", firestoreId));
  };

  /** Delete ALL customers in one batch */
  const clearAllCustomers = async (currentCustomers) => {
    const batch = writeBatch(db);
    currentCustomers.forEach((c) => {
      if (c.firestoreId) batch.delete(doc(db, "customers", c.firestoreId));
    });
    await batch.commit();
  };

  return {
    customers,
    loading,
    error,
    addCustomers,
    updateCustomer,
    deleteCustomer,
    clearAllCustomers,
  };
}
