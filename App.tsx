/**
 * Todoist-Style Task Manager for React Native
 * Features: Projects, Dark Mode, Notifications, Swipe Gestures
 * Works on both Android and iOS
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  SafeAreaView,
  StyleSheet,
  Alert,
  FlatList,
  StatusBar,
  Platform,
  Dimensions,
  useColorScheme, // For Dark Mode
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import {
  GestureHandlerRootView,
  Swipeable,
} from 'react-native-gesture-handler'; // For Swipe Gestures
import notifee, { TriggerType } from '@notifee/react-native'; // For Notifications

const { width, height } = Dimensions.get('window');

// --- Constants ---
const COLORS = {
  primary: '#dc2626', // Red (Todoist-like)
};
const STORAGE_KEY = '@todoist_tasks_v2';

// --- Type Definitions ---
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  dueTime?: string;
  project: string;
  tags: string[];
  createdAt: string;
  completedAt?: string;
  // New timetable-specific fields
  isRecurring?: boolean;
  recurringDays?: string[]; // ['monday', 'tuesday', ...]
  isTimeTableItem?: boolean;
  category?: 'timetable' | 'todo' | 'project';
}

interface Project {
  id: string;
  name: string;
  color: string;
  taskCount: number;
}

// Type for the new task form state
type NewTaskState = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  dueTime: string;
  project: string;
  tags: string[];
};

// --- Main App Component ---
const TaskManager = () => {
  // --- State Management ---
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects] = useState<Project[]>([
    { id: 'inbox', name: 'Inbox', color: '#3b82f6', taskCount: 0 },
    { id: 'work', name: 'Work', color: '#ef4444', taskCount: 0 },
    { id: 'personal', name: 'Personal', color: '#22c55e', taskCount: 0 },
    { id: 'health', name: 'Health & Fitness', color: '#f59e0b', taskCount: 0 },
  ]);

  const [activeProject, setActiveProject] = useState('inbox');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompleted, setFilterCompleted] = useState(false);

  const [newTask, setNewTask] = useState<NewTaskState>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    dueTime: '',
    project: 'inbox',
    tags: [],
  });

  // --- Dynamic Styles for Dark Mode ---
  const dynamicStyles = {
    container: {
      backgroundColor: isDark ? '#111827' : '#f9fafb',
    },
    header: {
      backgroundColor: COLORS.primary,
    },
    headerTitle: {
      color: '#ffffff',
    },
    card: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
    },
    text: {
      color: isDark ? '#f9fafb' : '#111827',
    },
    subtleText: {
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    borderColor: {
      borderColor: isDark ? '#374151' : '#e5e7eb',
    },
    input: {
      backgroundColor: isDark ? '#374151' : '#f9fafb',
      color: isDark ? '#f9fafb' : '#111827',
      borderColor: isDark ? '#4b5563' : '#e5e7eb',
    },
    modal: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
    },
  };

  // --- Data Persistence ---
  useEffect(() => {
    loadTasks();
    // Create a notification channel on app start
    notifee.createChannel({
      id: 'task-reminders',
      name: 'Task Reminders',
    });
  }, []);

  const loadTasks = async () => {
    try {
      const storedTasks = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const saveTasks = async (updatedTasks: Task[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
      setTasks(updatedTasks);
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  // --- Notification Logic ---
  const scheduleTaskNotification = async (task: Task) => {
    if (task.dueDate && task.dueTime) {
      try {
        const [hours, minutes] = task.dueTime.split(':');
        const dueDateTime = new Date(task.dueDate);
        dueDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Schedule only if the date is in the future
        if (dueDateTime.getTime() > Date.now()) {
          await notifee.createTriggerNotification(
            {
              id: task.id,
              title: 'Task Reminder',
              body: task.title,
              android: { channelId: 'task-reminders' },
            },
            {
              type: TriggerType.TIMESTAMP,
              timestamp: dueDateTime.getTime(),
            },
          );
        }
      } catch (e) {
        console.error('Failed to schedule notification:', e);
      }
    }
  };

  // --- Task Filtering and Sorting ---
  const filteredTasks = tasks.filter(task => {
    const matchesProject =
      activeProject === 'inbox' || task.project === activeProject;
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompleted = !filterCompleted || !task.completed;
    return matchesProject && matchesSearch && matchesCompleted;
  });

  const completedTasks = filteredTasks.filter(task => task.completed);
  const pendingTasks = filteredTasks.filter(task => !task.completed);

  // --- Helper Functions ---
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getProjectColor = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.color || '#6b7280';
  };

  // --- Task Actions ---
  const toggleTask = (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId
        ? {
            ...task,
            completed: !task.completed,
            completedAt: !task.completed ? new Date().toISOString() : undefined,
          }
        : task,
    );
    saveTasks(updatedTasks);
  };

  const addTask = () => {
    if (!newTask.title.trim()) {
      Alert.alert('Error', 'Task title is required');
      return;
    }
    const task: Task = {
      id: uuidv4(),
      title: newTask.title,
      description: newTask.description || undefined,
      completed: false,
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      dueTime: newTask.dueTime || undefined,
      project: newTask.project,
      tags: newTask.tags,
      createdAt: new Date().toISOString(),
    };
    const updatedTasks = [...tasks, task];
    saveTasks(updatedTasks);
    scheduleTaskNotification(task); // Schedule notification for new task
    resetNewTask();
    setShowAddTask(false);
  };

  const deleteTask = (taskId: string) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updatedTasks = tasks.filter(task => task.id !== taskId);
          saveTasks(updatedTasks);
          notifee.cancelNotification(taskId); // Cancel notification on delete
        },
      },
    ]);
  };

  const resetNewTask = () => {
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      dueTime: '',
      project: activeProject,
      tags: [],
    });
  };

  // --- Render Components ---
  const renderRightActions = (task: Task) => (
    <TouchableOpacity
      style={styles.swipeAction}
      onPress={() => toggleTask(task.id)}
    >
      <Text style={styles.swipeActionText}>
        {task.completed ? 'Undo' : 'Complete'}
      </Text>
    </TouchableOpacity>
  );

  const renderTaskItem = ({ item: task }: { item: Task }) => (
    <Swipeable renderRightActions={() => renderRightActions(task)}>
      <View
        style={[
          styles.taskCard,
          dynamicStyles.card,
          task.completed && styles.completedTask,
        ]}
      >
        <View style={styles.taskContent}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleTask(task.id)}
          >
            <View
              style={[
                styles.checkbox,
                dynamicStyles.borderColor,
                task.completed && styles.checkboxCompleted,
              ]}
            >
              {task.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
          <View style={styles.taskDetails}>
            <Text
              style={[
                styles.taskTitle,
                dynamicStyles.text,
                task.completed && styles.completedText,
              ]}
            >
              {task.title}
            </Text>
            {task.description && (
              <Text
                style={[
                  styles.taskDescription,
                  dynamicStyles.subtleText,
                  task.completed && styles.completedText,
                ]}
              >
                {task.description}
              </Text>
            )}
            <View style={styles.taskMeta}>
              {task.dueDate && (
                <View style={styles.metaItem}>
                  <Text style={[styles.metaText, dynamicStyles.subtleText]}>
                    📅 {formatDate(task.dueDate)}
                  </Text>
                  {task.dueTime && (
                    <Text style={[styles.metaText, dynamicStyles.subtleText]}>
                      {' '}
                      {task.dueTime}
                    </Text>
                  )}
                </View>
              )}
              {task.project !== 'inbox' && (
                <View style={styles.metaItem}>
                  <View
                    style={[
                      styles.projectDot,
                      { backgroundColor: getProjectColor(task.project) },
                    ]}
                  />
                  <Text style={[styles.metaText, dynamicStyles.subtleText]}>
                    {projects.find(p => p.id === task.project)?.name}
                  </Text>
                </View>
              )}
              {task.priority !== 'low' && (
                <View style={styles.priorityFlag}>
                  <Text
                    style={[
                      styles.priorityText,
                      { color: getPriorityColor(task.priority) },
                    ]}
                  >
                    🚩 {task.priority.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteTask(task.id)}
          >
            <Text style={styles.deleteText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );

  const renderProjectItem = ({ item: project }: { item: Project }) => (
    <TouchableOpacity
      style={[
        styles.projectItem,
        activeProject === project.id && styles.activeProjectItem,
      ]}
      onPress={() => {
        setActiveProject(project.id);
        setShowSidebar(false);
      }}
    >
      <View style={[styles.projectDot, { backgroundColor: project.color }]} />
      <Text
        style={[
          styles.projectName,
          dynamicStyles.text,
          activeProject === project.id && styles.activeProjectName,
        ]}
      >
        {project.name}
      </Text>
      <Text style={[styles.taskCount, dynamicStyles.subtleText]}>
        {tasks.filter(t => t.project === project.id && !t.completed).length}
      </Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, dynamicStyles.container]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

        {/* Header */}
        <View style={[styles.header, dynamicStyles.header]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowSidebar(true)}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>
            {projects.find(p => p.id === activeProject)?.name || 'Inbox'}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddTask(true)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, dynamicStyles.input]}
            placeholder="Search tasks..."
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Task List */}
        <FlatList
          data={[...pendingTasks, ...completedTasks]}
          renderItem={renderTaskItem}
          keyExtractor={item => item.id}
          style={styles.taskList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, dynamicStyles.text]}>
                All done! 🎉
              </Text>
              <Text style={[styles.emptySubtitle, dynamicStyles.subtleText]}>
                No tasks here. Add a new task to get started.
              </Text>
            </View>
          }
        />

        {/* Sidebar Modal */}
        <Modal
          visible={showSidebar}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSidebar(false)}
        >
          <View style={styles.sidebarOverlay}>
            <View style={[styles.sidebar, dynamicStyles.card]}>
              <View style={[styles.sidebarHeader, dynamicStyles.borderColor]}>
                <Text style={[styles.appTitle, dynamicStyles.text]}>
                  📋 Todoist
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowSidebar(false)}
                >
                  <Text
                    style={[styles.closeButtonText, dynamicStyles.subtleText]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={projects}
                renderItem={renderProjectItem}
                keyExtractor={item => item.id}
                style={styles.projectList}
              />
            </View>
          </View>
        </Modal>

        {/* Add Task Modal */}
        <Modal
          visible={showAddTask}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddTask(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, dynamicStyles.modal]}>
              <View style={[styles.modalHeader, dynamicStyles.borderColor]}>
                <Text style={[styles.modalTitle, dynamicStyles.text]}>
                  Add New Task
                </Text>
              </View>
              <ScrollView style={styles.modalContent}>
                <TextInput
                  style={[styles.input, dynamicStyles.input]}
                  placeholder="Task title"
                  placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                  value={newTask.title}
                  onChangeText={text =>
                    setNewTask(prev => ({ ...prev, title: text }))
                  }
                  autoFocus
                />
                <TextInput
                  style={[styles.input, styles.textArea, dynamicStyles.input]}
                  placeholder="Description (optional)"
                  placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                  value={newTask.description}
                  onChangeText={text =>
                    setNewTask(prev => ({ ...prev, description: text }))
                  }
                  multiline
                />
                <View style={styles.inputRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.dateInput,
                      dynamicStyles.input,
                    ]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                    value={newTask.dueDate}
                    onChangeText={text =>
                      setNewTask(prev => ({ ...prev, dueDate: text }))
                    }
                  />
                  <TextInput
                    style={[
                      styles.input,
                      styles.timeInput,
                      dynamicStyles.input,
                    ]}
                    placeholder="HH:MM"
                    placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                    value={newTask.dueTime}
                    onChangeText={text =>
                      setNewTask(prev => ({ ...prev, dueTime: text }))
                    }
                  />
                </View>
                <View style={styles.priorityContainer}>
                  {(['low', 'medium', 'high'] as const).map(priority => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.priorityButton,
                        dynamicStyles.borderColor,
                        newTask.priority === priority &&
                          styles.priorityButtonActive,
                      ]}
                      onPress={() =>
                        setNewTask(prev => ({ ...prev, priority }))
                      }
                    >
                      <Text
                        style={[
                          styles.priorityButtonText,
                          dynamicStyles.subtleText,
                          newTask.priority === priority &&
                            styles.priorityButtonTextActive,
                        ]}
                      >
                        {priority.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={[styles.modalActions, dynamicStyles.borderColor]}>
                <TouchableOpacity
                  style={[styles.cancelButton, dynamicStyles.borderColor]}
                  onPress={() => {
                    setShowAddTask(false);
                    resetNewTask();
                  }}
                >
                  <Text
                    style={[styles.cancelButtonText, dynamicStyles.subtleText]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={addTask}>
                  <Text style={styles.saveButtonText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 20,
    color: '#ffffff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  taskList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  taskCard: {
    borderRadius: 12,
    marginVertical: 4,
  },
  completedTask: {
    opacity: 0.6,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  taskDetails: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  priorityFlag: {
    marginLeft: 'auto',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: width * 0.8,
    height: '100%',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
  },
  projectList: {
    flex: 1,
    paddingTop: 20,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  activeProjectItem: {
    backgroundColor: '#fef2f2',
  },
  projectName: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  activeProjectName: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  taskCount: {
    fontSize: 14,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  timeInput: {
    flex: 1,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityButtonTextActive: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  swipeAction: {
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
  },
  swipeActionText: {
    color: 'white',
    fontWeight: '600',
    padding: 20,
  },
});

export default TaskManager;
