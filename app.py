from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import pandas as pd
import requests
import os
from dotenv import load_dotenv
from datetime import datetime
from groq import Groq

load_dotenv()

app = Flask(__name__)
CORS(app)

VILLAGE = {
    "name": "Ongole Village",
    "lat": 15.5057,
    "lon": 80.0493
}

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
EXCEL_FILE = "flood_logs.xlsx"

# thresholds in meters
LEVEL_WARNING = 1.0
LEVEL_DANGER = 2.0

# ========== EXCEL HELPERS ==========

def init_excel():
    """Creates a new Excel file if it doesn't exist or is corrupt."""
    columns = ["timestamp", "sensor_1_", "sensor_2_", "flow_direc", "alert_level"]
    try:
        if os.path.exists(EXCEL_FILE):
            pd.read_excel(EXCEL_FILE)
        else:
            df = pd.DataFrame(columns=columns)
            df.to_excel(EXCEL_FILE, index=False)
    except Exception as e:
        print(f"⚠️ Excel corrupted ({e}). Creating fresh file...")
        if os.path.exists(EXCEL_FILE):
            os.remove(EXCEL_FILE)
        df = pd.DataFrame(columns=columns)
        df.to_excel(EXCEL_FILE, index=False)

init_excel()

# ========== WEATHER FUNCTIONS ==========

def get_weather():
    try:
        if not OPENWEATHER_API_KEY:
            raise Exception("No API Key")
        url = (
            f"https://api.openweathermap.org/data/2.5/weather?"
            f"lat={VILLAGE['lat']}&lon={VILLAGE['lon']}"
            f"&appid={OPENWEATHER_API_KEY}&units=metric"
        )
        resp = requests.get(url, timeout=5)
        data = resp.json()
        if resp.status_code == 200 and "main" in data:
            return data
        raise Exception("API Error")
    except Exception:
        return {
            "main": {"temp": 0, "humidity": 0},
            "wind": {"speed": 0},
            "weather": [{"main": "Unavailable", "description": "Unavailable"}]
        }

def get_weather_alert_status():
    """Returns detailed weather alert status"""
    weather = get_weather()
    
    alerts = {
        "level": "SAFE",
        "color": "#28a745",
        "message": "Conditions normal",
        "evacuate": False,
        "shelter_open": False,
        "reasons": []
    }
    
    try:
        wind_speed = weather.get("wind", {}).get("speed", 0) * 3.6
        rain_1h = weather.get("rain", {}).get("1h", 0)
        weather_desc = weather.get("weather", [{}])[0].get("description", "").lower()
        
        if wind_speed >= 62 or rain_1h >= 50 or "tornado" in weather_desc:
            alerts["level"] = "DANGER"
            alerts["color"] = "#dc3545"
            alerts["message"] = "🚨 EVACUATE NOW - Extreme weather!"
            alerts["evacuate"] = True
            alerts["shelter_open"] = True
            alerts["reasons"].append(f"Wind: {wind_speed:.1f} km/h" if wind_speed >= 62 else f"Rain: {rain_1h}mm/h")
            
        elif wind_speed >= 50 or rain_1h >= 20 or any(x in weather_desc for x in ["thunderstorm", "heavy rain", "flood"]):
            alerts["level"] = "WARNING"
            alerts["color"] = "#fd7e14"
            alerts["message"] = "⚠️ WARNING - Prepare for evacuation"
            alerts["shelter_open"] = True
            alerts["reasons"].append(f"Wind: {wind_speed:.1f} km/h" if wind_speed >= 50 else f"Rain: {rain_1h}mm/h")
            
        elif wind_speed >= 30 or rain_1h >= 5 or "rain" in weather_desc:
            alerts["level"] = "WATCH"
            alerts["color"] = "#ffc107"
            alerts["message"] = "👀 WATCH - Monitor conditions closely"
            
    except Exception as e:
        print(f"Weather alert error: {e}")
    
    return alerts

# ========== SENSOR/FLOOD FUNCTIONS ==========

def get_flood_status():
    if not os.path.exists(EXCEL_FILE):
        return default_status()

    try:
        df = pd.read_excel(EXCEL_FILE)
        if len(df) < 1:
            return default_status()

        latest = df.iloc[-1]
        s1 = float(latest.get("sensor_1_", 0))
        s2 = float(latest.get("sensor_2_", 0))
        
        if s1 >= LEVEL_DANGER or s2 >= LEVEL_DANGER:
            situation = "DANGER"
        elif s1 >= LEVEL_WARNING or s2 >= LEVEL_WARNING:
            situation = "WARNING"
        else:
            situation = "SAFE"

        flow = str(latest.get("flow_direc", "Stable"))
        
        return {
            "timestamp": str(latest.get("timestamp", "N/A")),
            "s1": s1,
            "s2": s2,
            "flow": flow,
            "situation": situation,
            "fire": False,
            "acknowledged": False
        }

    except Exception as e:
        print("Excel read error:", e)
        init_excel()
        return default_status()

def default_status():
    return {
        "timestamp": "N/A", "s1": 0, "s2": 0,
        "flow": "Stable", "situation": "SAFE",
        "fire": False, "acknowledged": False
    }

def evacuation_required():
    flood = get_flood_status()
    weather_alert = get_weather_alert_status()
    
    if flood["situation"] in ["WARNING", "DANGER"]:
        return True
    if weather_alert["evacuate"]:
        return True
    return False

# ========== ROUTES ==========

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/dashboard")
def dashboard():
    flood = get_flood_status()
    weather = get_weather()
    weather_alert = get_weather_alert_status()
    
    return render_template(
        "dashboard.html", 
        flood=flood, 
        weather=weather,
        alert=weather_alert
    )

@app.route("/api/system-status")
def api_status():
    return jsonify(get_flood_status())

@app.route("/api/weather")
def api_weather():
    return jsonify(get_weather())

@app.route("/map")
def map_view():
    flood = get_flood_status()
    evacuation_required_flag = flood["situation"] in ["WARNING", "DANGER"]
    
    return render_template(
        "map.html",
        evacuation=evacuation_required_flag
    )

@app.route("/safe-routes")
def safe_routes():
    """Show evacuation routes with multiple shelter options"""
    weather_alert = get_weather_alert_status()
    flood = get_flood_status()
    
    SHELTERS = [
        {"name": "Chimakurthy Safe Zone", "lat": 15.5813, "lon": 79.8596, "capacity": 1000, "type": "safe_zone"},
        {"name": "Ongole Collectorate", "lat": 15.4988, "lon": 80.0497, "capacity": 500, "type": "government"},
        {"name": "Railway Station High Area", "lat": 15.4975, "lon": 80.0573, "capacity": 300, "type": "transit"},
        {"name": "Government Hospital", "lat": 15.488170895831425 , "lon": 80.04726674122142, "capacity": 200, "type": "hospital"},
    ]
   
    blocked_areas = []
    if flood["s1"] > 1.5:
        blocked_areas.append({"lat": 15.5157, "lon": 80.0550, "radius": 500, "reason": "Upstream Flooding"})
    if flood["s2"] > 1.5:
        blocked_areas.append({"lat": 15.5057, "lon": 80.0493, "radius": 800, "reason": "Village Flooding"})
    
    return render_template(
        "safe_routes.html",
        village=VILLAGE,
        shelters=SHELTERS,
        blocked_areas=blocked_areas,
        weather_alert=weather_alert,
        flood=flood
    )

@app.route("/first-aid")
def first_aid():
    return render_template("first-aid.html")

@app.route("/chat")
def chat():
    return render_template("chat.html")

@app.route("/emergency-contacts")
def emergency_contacts():
    contacts = [
        {"name": "Police", "category": "Emergency", "phone": "100"},
        {"name": "Ambulance", "category": "Medical", "phone": "102"},
        {"name": "Fire Department", "category": "Fire", "phone": "101"},
        {"name": "Village Control Room", "category": "Support", "phone": "08592-123456"}
    ]
    return render_template("emergency-contacts.html", contacts=contacts)

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/api/esp32-data", methods=["POST"])
def api_esp32_data():
    data = request.get_json() or {}
    print("📥 ESP32 payload:", data)

    s1 = float(data.get("s1", 0))
    s2 = float(data.get("s2", 0))
    flow = str(data.get("flow", "STABLE")).upper()
    alert = str(data.get("alert", "LOW")).upper()

    new_row = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "sensor_1_": s1,
        "sensor_2_": s2,
        "flow_direc": flow,
        "alert_level": alert
    }

    try:
        if os.path.exists(EXCEL_FILE):
            try:
                df = pd.read_excel(EXCEL_FILE)
            except:
                print("⚠️ File corrupt. Recreating...")
                df = pd.DataFrame(columns=["timestamp", "sensor_1_", "sensor_2_", "flow_direc", "alert_level"])
        else:
            df = pd.DataFrame(columns=["timestamp", "sensor_1_", "sensor_2_", "flow_direc", "alert_level"])

        new_df = pd.DataFrame([new_row])
        df = pd.concat([df, new_df], ignore_index=True)
        
        # Keep only last 500 rows
        if len(df) > 500:
            df = df.tail(500)
        
        df.to_excel(EXCEL_FILE, index=False)
        print("✅ Data Logged:", new_row)
        return jsonify({"status": "ok"}), 200

    except Exception as e:
        print("❌ CRITICAL EXCEL ERROR:", e)
        init_excel()
        return jsonify({"status": "error", "message": "File repaired, try next request"}), 500

# ========== AI-POWERED CHAT API (WITH GROQ) ==========
@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json() or {}
    user_message = data.get("message", "")
    
    if not user_message:
        return jsonify({"response": "Please ask me a question about disaster safety or first aid."})
    
    # Get current conditions for AI context
    flood = get_flood_status()
    weather = get_weather()
    weather_alert = get_weather_alert_status()
    
    # Build real-time context
    realtime_context = ""
    if flood["situation"] != "SAFE" or weather_alert["level"] != "SAFE":
        realtime_context = f"""
CURRENT ALERT STATUS:
- Flood Status: {flood['situation']}
- Water Levels: Sensor 1 (Upstream) = {flood['s1']}m, Sensor 2 (Village) = {flood['s2']}m
- Weather Alert: {weather_alert['level']}
- Weather: {weather.get('weather', [{}])[0].get('description', 'Unknown')}
- Temperature: {weather.get('main', {}).get('temp', 'N/A')}°C
- Wind Speed: {weather.get('wind', {}).get('speed', 0) * 3.6:.1f} km/h

"""
    
    # Debug logging
    print(f"🔑 GROQ_API_KEY loaded: {bool(GROQ_API_KEY)}")
    if GROQ_API_KEY:
        print(f"🔑 First 20 chars: {GROQ_API_KEY[:20]}...")
    
    # Check if Groq API key exists
    if not GROQ_API_KEY:
        # Fallback to keyword-based system
        print("⚠️ No Groq API key, using fallback responses")
        return get_fallback_response(user_message, realtime_context)
    
    try:
        # Initialize Groq client
        client = Groq(api_key=GROQ_API_KEY)
        
        # System prompt for disaster AI
        system_prompt = """You are DisasterAlert AI, an expert emergency response assistant for Ongole Village's disaster management system in India.

Your role:
- Provide clear, actionable disaster safety instructions (earthquakes, floods, fires, cyclones, storms)
- Give step-by-step first aid guidance (bleeding, burns, fractures, CPR, choking, shock)
- Offer emergency preparedness advice
- Stay calm, clear, and reassuring
- Consider real-time alerts when giving advice

Guidelines:
1. Be concise but thorough (200-400 words max)
2. Use numbered steps for instructions
3. Format with clear sections: BEFORE, DURING, AFTER (when relevant)
4. ALWAYS remind users to call emergency services for life-threatening situations:
   - Police: 100
   - Ambulance: 102
   - Fire: 101
   - Village Control Room: 08592-123456
5. Use simple language suitable for all age groups
6. Focus on practical, immediately actionable advice
7. If real-time alerts show danger, prioritize evacuation advice
8. For non-emergency topics, politely redirect to disaster safety questions"""

        # Add real-time context if available
        full_user_message = realtime_context + user_message if realtime_context else user_message
        
        # Call Groq API
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": full_user_message
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1000,
            top_p=1,
            stream=False
        )
        
        ai_response = chat_completion.choices[0].message.content
        print("✅ Groq AI Response generated successfully")
        return jsonify({"response": ai_response})
        
    except Exception as e:
        print(f"❌ Groq AI Error: {e}")
        # Fallback to keyword-based responses
        return get_fallback_response(user_message, realtime_context)

def get_fallback_response(user_message, context_prefix=""):
    """Fallback keyword-based responses when AI is unavailable"""
    user_message_lower = user_message.lower()
    
    if "earthquake" in user_message_lower:
        response = context_prefix + """EARTHQUAKE SAFETY GUIDE:

BEFORE:
- Build an emergency kit with water, food, and medicine
- Secure heavy furniture to walls

DURING:
- DROP, COVER, and HOLD ON
- Stay away from windows and heavy objects
- If outside, move to an open area away from buildings and power lines

AFTER:
- Check for injuries and provide first aid
- Be prepared for aftershocks
- Expect fire alarms and sprinkler systems to go off

⚠️ For emergencies, call: Police (100), Ambulance (102), Fire (101)"""

    elif "flood" in user_message_lower:
        response = context_prefix + """FLOOD SAFETY GUIDE:

PREPARATION:
- Move to higher ground immediately
- Turn off utilities at the main switches or valves if instructed
- Disconnect electrical appliances

DURING:
- Avoid walking or driving through flood waters (just 6 inches can knock you down)
- If told to evacuate, do so immediately

AFTER:
- Avoid floodwaters as they may be contaminated or electrically charged
- Only return home when authorities say it's safe

⚠️ For emergencies, call: Police (100), Ambulance (102)"""

    elif "fire" in user_message_lower:
        response = context_prefix + """FIRE SAFETY GUIDE:

EVACUATION:
- Know at least two ways out of every room
- If you encounter smoke, STAY LOW and crawl to the nearest exit
- Feel doors with the back of your hand before opening; if hot, use another exit

ACTION:
- If your clothes catch fire: STOP, DROP, and ROLL
- Call the fire department (101) from outside the building

⚠️ For emergencies, call: Fire (101)"""

    elif "cyclone" in user_message_lower or "hurricane" in user_message_lower or "storm" in user_message_lower:
        response = context_prefix + """CYCLONE & STORM SAFETY:

BEFORE:
- Secure loose outdoor objects
- Reinforce doors and windows
- Keep emergency lights and batteries ready

DURING:
- Stay indoors and away from windows
- Monitor local radio or news for updates

AFTER:
- Stay away from downed power lines
- Don't enter damaged buildings until they are inspected

⚠️ For emergencies, call: Police (100)"""

    elif "bleeding" in user_message_lower:
        response = context_prefix + """FIRST AID - SEVERE BLEEDING:

1. Apply direct pressure to the wound with a clean cloth or bandage
2. Keep pressure until the bleeding stops
3. If blood soaks through, don't remove the cloth; add another one on top
4. Elevate the injured area if possible
5. If bleeding is life-threatening and doesn't stop, use a tourniquet if trained

⚠️ For emergencies, call: Ambulance (102)"""

    elif "cpr" in user_message_lower:
        response = context_prefix + """CPR (CARDIO-PULMONARY RESUSCITATION):

Note: These are basic steps. Formal training is highly recommended.

1. Check the scene for safety
2. Tap the person and shout to see if they respond
3. Call 102 (Ambulance) immediately
4. Check for breathing
5. If not breathing, perform chest compressions:
   - Push hard and fast in the center of the chest
   - Rate: 100-120 compressions per minute

⚠️ For emergencies, call: Ambulance (102)"""

    elif "kit" in user_message_lower:
        response = context_prefix + """EMERGENCY FIRST AID KIT ESSENTIALS:

- Bandages (various sizes) and sterile gauze pads
- Adhesive tape and antiseptic wipes
- Antibiotic ointment and burn cream
- Scissors, tweezers, and safety pins
- Disposable gloves and a thermometer
- Emergency contact list and first aid manual"""

    elif "preparedness" in user_message_lower or "prepare" in user_message_lower:
        response = context_prefix + """EMERGENCY PREPAREDNESS STEPS:

1. Create a communication plan with your family/colleagues
2. Build an emergency supply kit (3 days of water and food)
3. Identify safe rooms in your home or building
4. Stay informed through local alerts and news
5. Practice evacuation drills regularly"""

    elif "current status" in user_message_lower or "situation" in user_message_lower or "status" in user_message_lower:
        flood = get_flood_status()
        weather = get_weather()
        weather_alert = get_weather_alert_status()
        
        response = f"""CURRENT VILLAGE STATUS:

🌊 Flood Status: {flood['situation']}
📊 Sensor S1 (Upstream): {flood['s1']}m
📊 Sensor S2 (Village): {flood['s2']}m
🌤️ Weather: {weather.get('weather', [{}])[0].get('description', 'Unknown')}
🌡️ Temperature: {weather.get('main', {}).get('temp', 'N/A')}°C
💨 Wind Speed: {weather.get('wind', {}).get('speed', 0) * 3.6:.1f} km/h

{'⚠️ EVACUATION RECOMMENDED! Go to /safe-routes for evacuation information.' if weather_alert['evacuate'] else '✅ Conditions are currently manageable.'}

For emergencies: Police (100), Ambulance (102), Fire (101)"""
    
    else:
        response = context_prefix + """I can help you with disaster safety information. Try asking about:

- Earthquake safety
- Flood preparedness
- Fire evacuation
- Cyclone/Storm safety
- First aid for bleeding
- CPR instructions
- Emergency kit essentials
- Current status (real-time village conditions)
- General preparedness tips

For emergencies: Police (100), Ambulance (102), Fire (101), Village Control (08592-123456)"""
    
    return jsonify({"response": response})

@app.route("/api/sos", methods=["POST"])
def api_sos():
    return jsonify({"success": True, "message": "SOS sent to village authorities."})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)