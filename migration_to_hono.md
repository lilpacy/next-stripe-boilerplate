既存のバックエンドAPIの使用状況を確認するために、まずコードベースを検索してみましょう。

Search files...


コードベースを分析した結果、以下のような主要なバックエンドAPIの操作が見つかりました：

1. 認証関連
- サインイン（`/app/(login)/actions.ts`の`signIn`）
- サインアップ（`signUp`）
- アカウント削除（`deleteAccount`）
- アカウント更新（`updateAccount`）

2. チーム関連
- チームメンバー削除（`removeTeamMember`）
- チームメンバー招待（`inviteTeamMember`）

3. 支払い関連
- チェックアウトセッション作成（`/lib/payments/actions.ts`の`checkoutAction`）
- Stripeウェブフック処理（`/app/api/stripe/checkout/route.ts`）

これらの操作をHonoのAPIとして再構築する場合、以下のような構造を提案します：

```typescript
// /backend/routes/auth.ts
import { Hono } from 'hono'
import { db } from '../lib/db'
import { hashPassword, comparePasswords } from '../lib/auth'

const auth = new Hono()

auth.post('/sign-in', async (c) => {
  const { email, password } = await c.req.json()
  
  // 既存のsignIn関数のロジックを移植
  const user = await db.users.findFirst({
    where: { email }
  })
  
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }
  
  const isValid = await comparePasswords(password, user.passwordHash)
  if (!isValid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // JWTトークンを生成して返す
  const token = generateJWT(user)
  return c.json({ token })
})

// /backend/routes/teams.ts
const teams = new Hono()

teams.delete('/members/:id', async (c) => {
  const memberId = c.param('id')
  const user = c.get('user') // ミドルウェアで設定されたユーザー情報
  
  // 既存のremoveTeamMember関数のロジックを移植
  await db.teamMembers.delete({
    where: {
      id: memberId,
      teamId: user.teamId
    }
  })
  
  return c.json({ success: true })
})

// /backend/routes/payments.ts
const payments = new Hono()

payments.post('/checkout', async (c) => {
  const { priceId } = await c.req.json()
  const user = c.get('user')
  
  // 既存のcheckoutAction関数のロジックを移植
  const session = await stripe.checkout.sessions.create({
    // ...
  })
  
  return c.json({ url: session.url })
})
```

主な変更点と推奨事項：

1. 認証システム
- JWTベースの認証に移行
- セッションCookieの代わりにAuthorizationヘッダーを使用

2. データベースアクセス
- Drizzle ORMは継続して使用可能
- トランザクション処理の実装方法を維持

3. エラーハンドリング
- Honoの標準的なエラーレスポンス形式に統一
- HTTPステータスコードの適切な使用

4. ミドルウェア
- 認証ミドルウェアの実装
- リクエストのバリデーション（zodを継続使用）

これらの変更を段階的に実装することで、サーバーコンポーネントからの依存を解消し、独立したバックエンドAPIとして再構築できます。

次のステップとして、具体的な実装を進めていきたいと思いますが、まず以下のどの部分から始めたいですか？

1. 認証システム（JWT実装）
2. チーム管理API
3. 支払い関連API
4. データベース接続層

ご希望の優先順位をお聞かせください。
