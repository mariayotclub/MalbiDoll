import pool from '../config/database.js';
export const Usuario = {
 async excluirConta(id) {
     const resultado = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
     return resultado.rowCount > 0;
 },
 async email(email){const r=await pool.query('SELECT * FROM usuarios WHERE email=$1',[email]);return r.rows[0]},
 async id(id){const r=await pool.query('SELECT id,nome,email,tipo,foto IS NOT NULL AS tem_foto,foto_tipo,apelido,criado_em FROM usuarios WHERE id=$1',[id]);return r.rows[0]},
 async criar(nome,email,hash){const r=await pool.query('INSERT INTO usuarios(nome,email,senha_hash) VALUES($1,$2,$3) RETURNING id',[nome,email,hash]);return r.rows[0]},
 async foto(id){const r=await pool.query('SELECT foto,foto_tipo FROM usuarios WHERE id=$1',[id]);return r.rows[0]},
 async atualizarFoto(id,buffer,tipo){await pool.query('UPDATE usuarios SET foto=$1,foto_tipo=$2 WHERE id=$3',[buffer,tipo,id])},
 async removerFoto(id){await pool.query('UPDATE usuarios SET foto=NULL,foto_tipo=NULL WHERE id=$1',[id])},
 async atualizarNome(id,nome,apelido){await pool.query('UPDATE usuarios SET nome=$1,apelido=$2 WHERE id=$3',[nome,apelido,id])},
 async senha(id){const r=await pool.query('SELECT senha_hash FROM usuarios WHERE id=$1',[id]);return r.rows[0]},
 async alterarSenha(id,hash){await pool.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2',[hash,id])},
 async enderecos(id){const r=await pool.query('SELECT * FROM usuario_enderecos WHERE usuario_id=$1 ORDER BY principal DESC,id DESC',[id]);return r.rows},
 async salvarEndereco(usuarioId,d){const c=await pool.connect();try{await c.query('BEGIN');const quantidade = await c.query('SELECT COUNT(*)::int AS total FROM usuario_enderecos WHERE usuario_id=$1',[usuarioId]);if (quantidade.rows[0].total === 0) d.principal = true;if(d.principal)await c.query('UPDATE usuario_enderecos SET principal=false WHERE usuario_id=$1',[usuarioId]);const r=await c.query(`INSERT INTO usuario_enderecos(usuario_id,apelido,cep,logradouro,numero,complemento,bairro,cidade,estado,principal) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[usuarioId,d.apelido,d.cep,d.logradouro,d.numero,d.complemento,d.bairro,d.cidade,d.estado,d.principal]);await c.query('COMMIT');return r.rows[0]}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}},
 async excluirEndereco(usuarioId,id){await pool.query('DELETE FROM usuario_enderecos WHERE usuario_id=$1 AND id=$2',[usuarioId,id])},
 async principalEndereco(usuarioId,id){const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query('SELECT id FROM usuario_enderecos WHERE usuario_id=$1 AND id=$2 FOR UPDATE',[usuarioId,id]);if(r.rowCount){await c.query('UPDATE usuario_enderecos SET principal=false WHERE usuario_id=$1',[usuarioId]);await c.query('UPDATE usuario_enderecos SET principal=true WHERE usuario_id=$1 AND id=$2',[usuarioId,id])}await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}},
 async editarEndereco(usuarioId, id, d) {
     const cliente = await pool.connect();

     try {
         await cliente.query('BEGIN');

         // Bloqueia o endereço para evitar editar registros de outra conta.
         const encontrado = await cliente.query(
             'SELECT id FROM usuario_enderecos WHERE usuario_id = $1 AND id = $2 FOR UPDATE',
             [usuarioId, id]
         );

         if (!encontrado.rowCount) {
             await cliente.query('ROLLBACK');
             return false;
         }

         if (d.principal) {
             await cliente.query(
                 'UPDATE usuario_enderecos SET principal = false WHERE usuario_id = $1',
                 [usuarioId]
             );
         }

         await cliente.query(
             `UPDATE usuario_enderecos
              SET apelido = $3, cep = $4, logradouro = $5, numero = $6,
                  complemento = $7, bairro = $8, cidade = $9, estado = $10,
                  principal = CASE WHEN $11 THEN true ELSE principal END
              WHERE usuario_id = $1 AND id = $2`,
             [
                 usuarioId, id, d.apelido, d.cep, d.logradouro, d.numero,
                 d.complemento, d.bairro, d.cidade, d.estado, d.principal
             ]
         );

         await cliente.query('COMMIT');
         return true;
     } catch (erro) {
         await cliente.query('ROLLBACK');
         throw erro;
     } finally {
         cliente.release();
     }
 }
};
