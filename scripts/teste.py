import subprocess

comando = [
    "curl",
    "-s",
    "-X", "POST",
    "http://localhost:3001/api/users",
    "-H", "Content-Type: application/json",
    "-d",
    """
{
  "name":"Usuario Teste",
  "email":"teste123@email.com",
  "password":"123456",
  "cpf":"1111111111",
  "telefone":"55999999999"
}
""",
    "-w", "\nHTTP_STATUS:%{http_code}"
]

resultado = subprocess.run(comando, capture_output=True, text=True)

saida = resultado.stdout

if "HTTP_STATUS:" in saida:
    corpo, status = saida.split("HTTP_STATUS:")
    print("Status HTTP:", status.strip())
    print("Resposta:")
    print(corpo.strip())
else:
    print(saida)

if resultado.stderr:
    print("Erro:")
    print(resultado.stderr)