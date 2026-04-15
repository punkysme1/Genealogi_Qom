import React, { useState, useEffect, useCallback } from 'react';
import { FamilyData, Individual, Family } from '../types';
import { initialFamilyData } from '../data/initialData';

const LOCAL_STORAGE_KEY = 'familyTreeData';

// Helper to convert Maps to JSON for storage
const replacer = (key: string, value: any) => {
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  } else {
    return value;
  }
};

// Helper to revive Maps from JSON
const reviver = (key: string, value: any) => {
  if(typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
};


export const useFamilyData = () => {
  const [data, setData] = useState<FamilyData>({ individuals: new Map(), families: new Map(), rootIndividualId: '' });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData, reviver);
        // Ensure maps are correctly revived
        if (parsedData.individuals instanceof Map && parsedData.families instanceof Map) {
          setData(parsedData);
        } else {
           setData(initialFamilyData);
        }
      } else {
        setData(initialFamilyData);
      }
    } catch (error) {
      console.error("Failed to load data from local storage, using initial data.", error);
      setData(initialFamilyData);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        const dataToSave = JSON.stringify(data, replacer);
        localStorage.setItem(LOCAL_STORAGE_KEY, dataToSave);
      } catch (error) {
        console.error("Failed to save data to local storage.", error);
      }
    }
  }, [data, isLoaded]);

  const updateIndividual = useCallback((individual: Individual) => {
    setData(prevData => {
      const newIndividuals = new Map(prevData.individuals);
      const oldIndividual = prevData.individuals.get(individual.id);
      newIndividuals.set(individual.id, individual);

      const newFamilies = new Map(prevData.families);

      // if childInFamilyId changed, update corresponding families
      if (oldIndividual?.childInFamilyId !== individual.childInFamilyId) {
        // remove from old family
        if (oldIndividual?.childInFamilyId) {
          const oldFamily = newFamilies.get(oldIndividual.childInFamilyId);
          if (oldFamily) {
            newFamilies.set(oldFamily.id, {
              ...oldFamily,
              childrenIds: oldFamily.childrenIds.filter(id => id !== individual.id)
            });
          }
        }
        // add to new family
        if (individual.childInFamilyId) {
          const newFamily = newFamilies.get(individual.childInFamilyId);
          if (newFamily && !newFamily.childrenIds.includes(individual.id)) {
             newFamilies.set(newFamily.id, {
              ...newFamily,
              childrenIds: [...newFamily.childrenIds, individual.id]
            });
          }
        }
      }

      return { ...prevData, individuals: newIndividuals, families: newFamilies };
    });
  }, []);

  const addIndividual = useCallback((individual: Omit<Individual, 'id'>) => {
     setData(prevData => {
      const newIndividuals = new Map(prevData.individuals);
      const newId = `i${Date.now()}`;
      const newIndividual = { ...individual, id: newId };
      newIndividuals.set(newId, newIndividual);

      const newFamilies = new Map(prevData.families);
      if (newIndividual.childInFamilyId) {
          const newFamily = newFamilies.get(newIndividual.childInFamilyId);
          if (newFamily && !newFamily.childrenIds.includes(newId)) {
             newFamilies.set(newFamily.id, {
              ...newFamily,
              childrenIds: [...newFamily.childrenIds, newId]
            });
          }
      }

      return { ...prevData, individuals: newIndividuals, families: newFamilies };
    });
  }, []);

  const deleteIndividual = useCallback((individualId: string) => {
    setData(prevData => {
      const newIndividuals = new Map(prevData.individuals);
      newIndividuals.delete(individualId);
      
      const newFamilies = new Map(prevData.families);
      newFamilies.forEach((family, familyId) => {
        let updated = false;
        const newFamily = { ...family };
        
        if (newFamily.spouse1Id === individualId) { newFamily.spouse1Id = undefined; updated = true; }
        if (newFamily.spouse2Id === individualId) { newFamily.spouse2Id = undefined; updated = true; }
        
        const newChildren = newFamily.childrenIds.filter(id => id !== individualId);
        if (newChildren.length < family.childrenIds.length) {
            newFamily.childrenIds = newChildren;
            updated = true;
        }
        
        if (updated) {
          newFamilies.set(familyId, newFamily);
        }
      });

      return { ...prevData, individuals: newIndividuals, families: newFamilies };
    });
  }, []);
  
  const updateFamily = useCallback((updatedFamily: Family) => {
    setData(prevData => {
      const newFamilies = new Map(prevData.families);
      const newIndividuals = new Map(prevData.individuals);
      const oldFamily = prevData.families.get(updatedFamily.id);

      const addedChildrenIds = updatedFamily.childrenIds.filter(id => !oldFamily?.childrenIds.includes(id));
      addedChildrenIds.forEach(childId => {
          const child = newIndividuals.get(childId);
          if (child) {
              if (child.childInFamilyId) {
                  const previousParentFamily = newFamilies.get(child.childInFamilyId);
                  if (previousParentFamily) {
                      newFamilies.set(previousParentFamily.id, { ...previousParentFamily, childrenIds: previousParentFamily.childrenIds.filter(id => id !== childId) });
                  }
              }
              newIndividuals.set(childId, { ...child, childInFamilyId: updatedFamily.id });
          }
      });
      
      const removedChildrenIds = oldFamily ? oldFamily.childrenIds.filter(id => !updatedFamily.childrenIds.includes(id)) : [];
      removedChildrenIds.forEach(childId => {
          const child = newIndividuals.get(childId);
          if (child && child.childInFamilyId === updatedFamily.id) {
              newIndividuals.set(childId, { ...child, childInFamilyId: undefined });
          }
      });
      
      newFamilies.set(updatedFamily.id, updatedFamily);

      return { ...prevData, families: newFamilies, individuals: newIndividuals };
    });
  }, []);

  const addFamily = useCallback((familyData: Omit<Family, 'id'>) => {
    setData(prevData => {
        const newFamilies = new Map(prevData.families);
        const newIndividuals = new Map(prevData.individuals);
        const newId = `f${Date.now()}`;
        const newFamily: Family = { ...familyData, id: newId };
        
        newFamily.childrenIds.forEach(childId => {
            const child = newIndividuals.get(childId);
            if (child) {
                if(child.childInFamilyId) {
                    const oldFamily = newFamilies.get(child.childInFamilyId);
                    if(oldFamily) {
                        newFamilies.set(oldFamily.id, { ...oldFamily, childrenIds: oldFamily.childrenIds.filter(id => id !== childId) });
                    }
                }
                newIndividuals.set(childId, { ...child, childInFamilyId: newId });
            }
        });
        
        newFamilies.set(newId, newFamily);
        return { ...prevData, families: newFamilies, individuals: newIndividuals };
    });
  }, []);

  const deleteFamily = useCallback((familyId: string) => {
    setData(prevData => {
        const familyToDelete = prevData.families.get(familyId);
        if (!familyToDelete) return prevData;
        
        const newFamilies = new Map(prevData.families);
        newFamilies.delete(familyId);

        const newIndividuals = new Map(prevData.individuals);
        familyToDelete.childrenIds.forEach(childId => {
            const child = newIndividuals.get(childId);
            if (child && child.childInFamilyId === familyId) {
                newIndividuals.set(childId, { ...child, childInFamilyId: undefined });
            }
        });

        return { ...prevData, individuals: newIndividuals, families: newFamilies };
    });
  }, []);

  const exportData = useCallback(() => {
    try {
        const dataStr = JSON.stringify(data, replacer, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = 'family_tree_data.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    } catch(e) {
        console.error("Error exporting data:", e);
        alert("Could not export data.");
    }
  }, [data]);
  
  const importData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = event.target?.result as string;
            if(!json) throw new Error("File is empty");
            const parsedData = JSON.parse(json, reviver);
             if (parsedData.individuals instanceof Map && parsedData.families instanceof Map && parsedData.rootIndividualId) {
                setData(parsedData);
                alert("Data imported successfully!");
             } else {
                throw new Error("Invalid data format.");
             }
        } catch (e) {
            console.error("Error importing data:", e);
            alert("Failed to import data. Please check the file format.");
        }
    };
    reader.readAsText(file);
  }, []);


  return { data, isLoaded, updateIndividual, addIndividual, deleteIndividual, addFamily, updateFamily, deleteFamily, exportData, importData, setData };
};

export const FamilyDataContext = React.createContext<ReturnType<typeof useFamilyData> | null>(null);

export const useFamily = () => {
    const context = React.useContext(FamilyDataContext);
    if (!context) {
        throw new Error('useFamily must be used within a FamilyData.Provider');
    }
    return context;
};