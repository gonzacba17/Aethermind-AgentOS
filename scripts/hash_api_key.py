import bcrypt

api_key = b'ak_da955087b123f8edee27231d122b2a9f50e98d847dc68646b9214af7153b85bc'

# Generate hash with bcrypt (salt rounds = 10)
hashed = bcrypt.hashpw(api_key, bcrypt.gensalt(rounds=10))

print('\n========================================')
print('  🔒 API Key Hash Generated')
print('========================================\n')
print('API_KEY_HASH:')
print(hashed.decode('utf-8'))
print('\n========================================')
print('📋 Copia esto a Railway:')
print('========================================\n')
print(f'API_KEY_HASH={hashed.decode("utf-8")}')
print('\n========================================\n')
