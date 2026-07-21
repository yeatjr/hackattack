import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "./src/firebase.js";

async function clearCollection(collName) {
  const querySnapshot = await getDocs(collection(db, collName));
  const deletePromises = [];
  querySnapshot.forEach((document) => {
    deletePromises.push(deleteDoc(doc(db, collName, document.id)));
  });
  await Promise.all(deletePromises);
  console.log(`Deleted ${deletePromises.length} documents from ${collName}`);
}

async function main() {
  await clearCollection("customers");
  await clearCollection("saas_users");
  await clearCollection("events");
  await clearCollection("saas_events");
  console.log("Firebase wiped successfully!");
  process.exit(0);
}

main();
