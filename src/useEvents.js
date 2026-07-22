import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "./firebase";

export function useEvents(customerId = null) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(collection(db, "events"), orderBy("created_at", "desc"), limit(50));
    
    if (customerId) {
      q = query(collection(db, "events"), where("customer_id", "==", customerId), orderBy("created_at", "desc"), limit(20));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(data);
      setLoading(false);
    });

    return unsub;
  }, [customerId]);

  return { events, loading };
}
