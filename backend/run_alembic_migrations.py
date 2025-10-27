#!/usr/bin/env python3
# run_alembic_migrations.py

import subprocess
import sys
import os

def run_migration_command(command):
    """Запустить команду Alembic"""
    try:
        result = subprocess.run(
            ['alembic'] + command.split(),
            cwd=os.path.dirname(os.path.abspath(__file__)),
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Ошибка выполнения команды: {e}")
        print(f"Stderr: {e.stderr}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Использование: python run_alembic_migrations.py <команда>")
        print("Доступные команды:")
        print("  upgrade head - применить все миграции")
        print("  downgrade -1 - откатить последнюю миграцию")
        print("  current - показать текущую версию")
        print("  history - показать историю миграций")
        print("  revision --autogenerate -m 'описание' - создать новую миграцию")
        sys.exit(1)
    
    command = ' '.join(sys.argv[1:])
    success = run_migration_command(command)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
