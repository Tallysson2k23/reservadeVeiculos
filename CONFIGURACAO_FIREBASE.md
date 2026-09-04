# Ativação das regras administrativas

As alterações do site dependem das Cloud Functions e das regras do Firestore deste repositório.

## 1. Bloquear cadastro direto de usuários

No console do Google Cloud/Firebase, ative o **Firebase Authentication with Identity Platform** e, nas configurações de autenticação, desative a criação e a exclusão de conta pelo usuário final (**User actions / Enable create** e **Enable delete**).

Essa configuração impede cadastros feitos diretamente pela API pública. O administrador continua conseguindo criar contas pela tela protegida do sistema, pois ela usa o Firebase Admin SDK no servidor.

## 2. Instalar e publicar o backend

Na raiz do projeto:

```powershell
npm --prefix functions install
npx firebase-tools login
npx firebase-tools deploy --only functions,firestore:rules
```

Depois, publique os arquivos da pasta `public` pelo processo de hospedagem já usado pelo projeto. Se o site também estiver no Firebase Hosting, use:

```powershell
npx firebase-tools deploy --only hosting
```

## 3. Conferência

- Entrar como um usuário comum: não deve aparecer cadastro; a devolução deve aparecer somente nos itens solicitados por ele.
- Entrar como `admin@gmail.com`: devem aparecer **NOVO USUÁRIO**, **ADMIN** e a devolução de qualquer item em uso.
- Criar um usuário pela tela **NOVO USUÁRIO** e confirmar que a sessão do administrador continua ativa.
- Conferir no histórico uma retirada e uma `devolucao`; quando o administrador devolver o item de outra pessoa, conferir uma `devolucao_admin`.
- Após as 23h no fuso `America/Sao_Paulo`, conferir uma `devolucao_automatica` para cada item que estava indisponível.
