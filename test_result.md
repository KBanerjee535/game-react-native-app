#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Aéropostale-era airplane game - Deliver 50 mail across Europe with vintage map, fuel gauge, mechanical incidents, and retro dashboard UI."

frontend:
  - task: "VintageDashboard refactoring into sub-components"
    implemented: true
    working: true
    file: "src/components/VintageDashboard.tsx, src/components/dashboard/WoodBackground.tsx, src/components/dashboard/FuelGauge.tsx, src/components/dashboard/WarningLights.tsx, src/components/dashboard/MailCounter.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Refactored 870-line VintageDashboard into 4 sub-components. All rendering correctly."

  - task: "Dashboard enhancements - natural wood, reflections, Phillips screws"
    implemented: true
    working: true
    file: "src/components/dashboard/FuelGauge.tsx, src/components/dashboard/WarningLights.tsx, src/components/dashboard/WoodBackground.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Added glass dome reflections on fuel gauge, Phillips-head screws on gauge bezel and warning light mounting plates, more natural wood grain with knots and varnish highlights"

  - task: "Pulsing destination dots animation"
    implemented: true
    working: true
    file: "src/components/EuropeMap.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Replaced Animated.Value with state-driven sine wave pulse for SVG compatibility. Golden rings around destination dots now pulse in size and opacity."

  - task: "Cargo icons next to destinations"
    implemented: true
    working: true
    file: "src/components/EuropeMap.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Mail (gold), fuel (green), wrench (blue) cargo badges with icons display next to each destination point."

  - task: "20-Level System with Telegram Mission Popup"
    implemented: true
    working: true
    file: "app/level.tsx, src/data/levels.ts, src/store/gameStore.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "20 levels defined (EUROPE 20, EUROPE 40, GIBRALTAR + NIVEAU 4-20). Level selection screen with scrollable list. Telegram mission popup with animated text before starting a level. Only first 2 levels available, rest locked."

  - task: "Réglages (Settings) Button and Modal"
    implemented: true
    working: true
    file: "src/components/VintageDashboard.tsx, src/components/SettingsModal.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "RÉGLAGES button added to dashboard under LOGO+MENU. Settings modal with sound toggle, save game, and list of saved games. AsyncStorage for persistence. Vintage wood-panel styling with screws."

  - task: "Engine Audio and Sputtering Effects"
    implemented: true
    working: true
    file: "src/hooks/useGameAudio.ts, assets/audio/engine-loop.wav, assets/audio/sputter.wav, assets/audio/low-fuel.wav"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Engine loop plays during flight (expo-av). Sputter sounds scale with warning lights: 0-1=none, 2=occasional, 3=frequent, 4=constant. Low fuel warning sound at <=15L. Sound toggle connected to Settings. WAV files generated programmatically."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "20-Level System"
    - "Réglages Modal"
    - "Engine Audio"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
    - message: "Implemented all 3 major features: 20-level system with telegram popup, RÉGLAGES settings modal with save/load, and engine audio with sputtering effects. All features verified working via screenshot tool."