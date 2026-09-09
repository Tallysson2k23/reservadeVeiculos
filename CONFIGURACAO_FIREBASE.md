# Configuração do Firebase

## Cadastro de usuários sem Cloud Functions

A página public/cadastro.html cria contas diretamente no Firebase Authentication.
Não é necessário publicar a função criarUsuario nem ativar o plano Blaze para esse cadastro.
Qualquer pessoa pode acessar a página, mesmo sem login. O botão NOVO USUÁRIO
continua visível apenas para admin@gmail.com na tela de veículos.

No Firebase Console, em Authentication, mantenha o provedor Email/senha habilitado.
Se a criação de contas pelo usuário final foi desativada anteriormente nas
configurações do Identity Platform (User actions / Enable create), habilite-a novamente.

O cadastro usa uma instância temporária com autenticação apenas em memória para
preservar a sessão atual. A nova conta poderá entrar pela tela de login normalmente.

Para testar localmente, recarregue cadastro.html pelo Live Server. Para atualizar
o site hospedado, publique os arquivos da pasta public pelo processo de hospedagem
usado pelo projeto.

## Conferência

- Como admin@gmail.com, verificar o botão NOVO USUÁRIO e cadastrar uma conta.
- Confirmar que o administrador continua conectado após o cadastro.
- Como usuário comum, confirmar que o botão não aparece na tela de veículos.
- Abrir cadastro.html diretamente, sem login, e conferir que a página permanece acessível.
- Conferir mensagens para email já cadastrado, email inválido, senha fraca e falha de conexão.

## Demais recursos

As regras do Firestore e as funções de retirada, devolução e devolução automática
são configurações separadas. Esta alteração libera apenas o cadastro direto;
não muda as permissões dos veículos nem publica funções. O código de funções
permanece na pasta functions, mas a tela de cadastro não chama mais criarUsuario.
