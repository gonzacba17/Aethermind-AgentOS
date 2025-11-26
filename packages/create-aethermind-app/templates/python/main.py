import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

def main():
    print("🤖 Starting Aethermind Agent...\n")
    
    # Initialize OpenAI client
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # Create a simple agent interaction
    user_input = "Tell me a short joke about programming."
    print(f"📝 User: {user_input}")
    print("⏳ Thinking...\n")
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful AI assistant."},
            {"role": "user", "content": user_input}
        ],
        temperature=0.7,
        max_tokens=500
    )
    
    result = response.choices[0].message.content
    print(f"✅ Agent: {result}\n")
    
    # Display usage info
    print(f"💰 Tokens used: {response.usage.total_tokens}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)
