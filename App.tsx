/**
 * Timetable Reminder App
 *
 * This React Native application allows users to create and manage multiple
 * timetable lists (categories). For each list, users can add, edit, and
 * remove tasks, and schedule repeating daily notifications. Data is saved
 * to the device's local storage.
 *
 * @format
 */
import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ListRenderItem,
  Modal,
  TextInput,
} from 'react-native';
import notifee, {
  TimestampTrigger,
  TriggerType,
  RepeatFrequency,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import {v4 as uuidv4} from 'uuid';

// --- Type Definitions ---
interface TimetableItem {
  id: string;
  time: string; // Stored in 24-hour format (e.g., "14:30")
  task: string;
}

interface TimetableList {
  id: string;
  name: string;
  tasks: TimetableItem[];
}

// --- Initial Data (only used if no saved data exists) ---
const INITIAL_DATA: TimetableList[] = [
  {
    id: uuidv4(),
    name: 'Default Timetable',
    tasks: [
      {id: '1', time: '06:00', task: 'Wake up'},
      {id: '2', time: '06:15', task: 'Go to walk'},
      {id: '3', time: '10:00', task: 'Go to College'},
      {id: '4', time: '19:30', task: 'Fresh up and have dinner'},
      {id: '5', time: '20:30', task: 'Study new topics'},
    ],
  },
];

const STORAGE_KEY = '@timetable_lists_v2';

// --- Main App Component ---
const App = () => {
  const [lists, setLists] = useState<TimetableList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState<TimetableItem | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [currentTask, setCurrentTask] = useState('');
  const [newListName, setNewListName] = useState('');

  // --- Data Loading and Saving ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedData !== null) {
          const parsedLists: TimetableList[] = JSON.parse(storedData);
          setLists(parsedLists);
          // Set the first list as active if one exists
          if (parsedLists.length > 0) {
            setActiveListId(parsedLists[0].id);
          }
        } else {
          setLists(INITIAL_DATA);
          setActiveListId(INITIAL_DATA[0].id);
        }
      } catch (e) {
        console.error('Failed to load data.', e);
        setLists(INITIAL_DATA);
      }
    };
    loadData();
  }, []);

  const saveData = async (newLists: TimetableList[]) => {
    try {
      setLists(newLists);
      const jsonValue = JSON.stringify(newLists);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save data.', e);
    }
  };

  // --- Helper Functions ---
  const formatTime12Hour = (time24: string) => {
    if (!time24 || !time24.includes(':')) return 'Invalid Time';
    const [hour, minute] = time24.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0',
    )} ${ampm}`;
  };

  const getActiveList = () => lists.find(l => l.id === activeListId);

  // --- List Management Handlers ---
  const handleAddList = () => {
    if (!newListName.trim()) {
      Alert.alert('Invalid Name', 'List name cannot be empty.');
      return;
    }
    const newList: TimetableList = {
      id: uuidv4(),
      name: newListName.trim(),
      tasks: [],
    };
    const updatedLists = [...lists, newList];
    saveData(updatedLists);
    setActiveListId(newList.id);
    setNewListName('');
    setListModalVisible(false);
  };

  const handleDeleteList = (listId: string) => {
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this entire list and all its tasks?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          onPress: () => {
            const updatedLists = lists.filter(l => l.id !== listId);
            saveData(updatedLists);
            // If the deleted list was active, switch to another one or set to null
            if (activeListId === listId) {
              setActiveListId(updatedLists.length > 0 ? updatedLists[0].id : null);
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  // --- Task Management Handlers ---
  const handleAddTask = () => {
    setIsEditingTask(null);
    setCurrentTime('');
    setCurrentTask('');
    setTaskModalVisible(true);
  };

  const handleEditTask = (task: TimetableItem) => {
    setIsEditingTask(task);
    setCurrentTime(task.time);
    setCurrentTask(task.task);
    setTaskModalVisible(true);
  };

  const handleSaveTask = () => {
    if (!currentTask || !/^\d{2}:\d{2}$/.test(currentTime)) {
      Alert.alert('Invalid Input', 'Please enter a task and time in HH:MM format.');
      return;
    }

    const activeList = getActiveList();
    if (!activeList) return;

    let updatedTasks;
    if (isEditingTask) {
      updatedTasks = activeList.tasks.map(task =>
        task.id === isEditingTask.id
          ? {...task, time: currentTime, task: currentTask}
          : task,
      );
    } else {
      const newTask: TimetableItem = {
        id: uuidv4(),
        time: currentTime,
        task: currentTask,
      };
      updatedTasks = [...activeList.tasks, newTask];
    }

    // Sort tasks by time
    updatedTasks.sort((a, b) => a.time.localeCompare(b.time));

    const updatedLists = lists.map(list =>
      list.id === activeListId ? {...list, tasks: updatedTasks} : list,
    );
    saveData(updatedLists);
    setTaskModalVisible(false);
  };

  const handleDeleteTask = (taskId: string) => {
    const activeList = getActiveList();
    if (!activeList) return;

    const updatedTasks = activeList.tasks.filter(task => task.id !== taskId);
    const updatedLists = lists.map(list =>
      list.id === activeListId ? {...list, tasks: updatedTasks} : list,
    );
    saveData(updatedLists);
  };

  // --- Notification Handler ---
  const scheduleAllNotifications = async () => {
    const activeList = getActiveList();
    if (!activeList || activeList.tasks.length === 0) {
      Alert.alert('No Tasks', 'There are no tasks in the current list to schedule.');
      return;
    }

    try {
      await notifee.requestPermission();
      const channelId = await notifee.createChannel({
        id: 'timetable-reminders',
        name: 'Timetable Reminders',
      });
      await notifee.cancelAllNotifications();

      for (const item of activeList.tasks) {
        const [hour, minute] = item.time.split(':').map(Number);
        const triggerDate = new Date();
        triggerDate.setHours(hour, minute, 0, 0);
        if (triggerDate.getTime() < Date.now()) {
          triggerDate.setDate(triggerDate.getDate() + 1);
        }
        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerDate.getTime(),
          repeatFrequency: RepeatFrequency.DAILY,
        };
        await notifee.createTriggerNotification(
          {
            id: item.id,
            title: `Time for: ${item.task}`,
            body: `It's ${formatTime12Hour(item.time)}. From your '${
              activeList.name
            }' list.`,
            android: {channelId, pressAction: {id: 'default'}},
          },
          trigger,
        );
      }
      Alert.alert(
        'Notifications Scheduled!',
        `Reminders for "${activeList.name}" have been set up.`,
      );
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  };

  // --- Render Functions ---
  const renderTaskItem: ListRenderItem<TimetableItem> = ({item}) => (
    <View style={styles.itemContainer}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime12Hour(item.time)}</Text>
      </View>
      <View style={styles.taskContainer}>
        <Text style={styles.taskText}>{item.task}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity onPress={() => handleEditTask(item)}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteTask(item.id)}>
          <Text style={[styles.actionText, styles.deleteText]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const activeList = getActiveList();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a202c" />

      {/* Modal for Adding/Editing Tasks */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={taskModalVisible}
        onRequestClose={() => setTaskModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>
              {isEditingTask ? 'Edit Task' : 'Add New Task'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Task Description"
              placeholderTextColor="#999"
              value={currentTask}
              onChangeText={setCurrentTask}
            />
            <TextInput
              style={styles.input}
              placeholder="Time (HH:MM, 24-hour format)"
              placeholderTextColor="#999"
              value={currentTime}
              onChangeText={setCurrentTime}
              keyboardType="numeric"
              maxLength={5}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setTaskModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.scheduleButton]}
                onPress={handleSaveTask}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for Managing Lists */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={listModalVisible}
        onRequestClose={() => setListModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Manage Timetables</Text>
            <FlatList
              data={lists}
              keyExtractor={item => item.id}
              renderItem={({item}) => (
                <View style={styles.listItem}>
                  <TouchableOpacity
                    style={{flex: 1}}
                    onPress={() => {
                      setActiveListId(item.id);
                      setListModalVisible(false);
                    }}>
                    <Text style={styles.listName}>{item.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteList(item.id)}>
                    <Text style={styles.deleteText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <TextInput
              style={styles.input}
              placeholder="New list name..."
              placeholderTextColor="#999"
              value={newListName}
              onChangeText={setNewListName}
            />
            <TouchableOpacity
              style={[styles.button, styles.addButton]}
              onPress={handleAddList}>
              <Text style={styles.buttonText}>+ Create New List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>{activeList?.name || 'No List Selected'}</Text>
        <TouchableOpacity onPress={() => setListModalVisible(true)}>
          <Text style={styles.manageButton}>Manage Lists</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeList?.tasks || []}
        renderItem={renderTaskItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.button, styles.addButton]}
            onPress={handleAddTask}>
            <Text style={styles.buttonText}>+ Add New Task</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyComponent}>
            <Text style={styles.emptyText}>This list is empty.</Text>
            <Text style={styles.emptyText}>Add a new task to get started!</Text>
          </View>
        }
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.scheduleButton]}
          onPress={scheduleAllNotifications}>
          <Text style={styles.buttonText}>Schedule Reminders for This List</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1a202c'},
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  title: {fontSize: 24, fontWeight: 'bold', color: '#e2e8f0'},
  manageButton: {color: '#4299e1', fontSize: 16, marginTop: 5},
  list: {padding: 16},
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  timeContainer: {width: 100},
  timeText: {fontSize: 16, fontWeight: 'bold', color: '#a0aec0'},
  taskContainer: {flex: 1},
  taskText: {fontSize: 16, color: '#e2e8f0'},
  itemActions: {flexDirection: 'column', alignItems: 'flex-end'},
  actionText: {color: '#4299e1', marginLeft: 10, paddingVertical: 4},
  deleteText: {color: '#c53030'},
  buttonContainer: {padding: 16, borderTopWidth: 1, borderTopColor: '#2d3748'},
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {backgroundColor: '#4a5568', marginTop: 10},
  scheduleButton: {backgroundColor: '#38a169'},
  cancelButton: {backgroundColor: '#718096'},
  buttonText: {color: 'white', fontSize: 16, fontWeight: 'bold'},
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#2d3748',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#1a202c',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: '#e2e8f0',
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  emptyComponent: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {color: '#a0aec0', fontSize: 16, textAlign: 'center'},
  // List Management Modal Styles
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
    width: '100%',
  },
  listName: {color: '#e2e8f0', fontSize: 18},
});

export default App;
