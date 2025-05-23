CREATE TABLE perfiles (
  perfil_id INTEGER UNSIGNED  NOT NULL   AUTO_INCREMENT,
  perfil_descripcion VARCHAR(50)  NULL    ,
PRIMARY KEY(perfil_id));



CREATE TABLE personas (
  persona_id INTEGER UNSIGNED  NOT NULL   AUTO_INCREMENT,
  persona_nombre VARCHAR(60)  NULL  ,
  persona_apellido VARCHAR(60)  NULL  ,
  persona_dni VARCHAR(60)  NULL  ,
  persona_fecha_nac DATE  NULL  ,
  persona_domicilio VARCHAR(255)  NULL  ,
  persona_telefono VARCHAR(20)  NULL  ,
  persona_fecha_alta DATE  NULL  ,
  persona_cuit VARCHAR(50)  NULL    ,
PRIMARY KEY(persona_id));



CREATE TABLE estados_usuarios (
  estado_usuario_id INTEGER UNSIGNED  NOT NULL   AUTO_INCREMENT,
  estado_usuario_nombre VARCHAR(50)  NULL    ,
PRIMARY KEY(estado_usuario_id));



CREATE TABLE modulos (
  modulo_id INTEGER UNSIGNED  NOT NULL   AUTO_INCREMENT,
  modulo_padre_id INTEGER UNSIGNED  NULL  ,
  modulo_descripcion VARCHAR(50)  NULL    ,
PRIMARY KEY(modulo_id)  ,
INDEX modulos_FKIndex1(modulo_padre_id),
  FOREIGN KEY(modulo_padre_id)
    REFERENCES modulos(modulo_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);



CREATE TABLE permisos (
  permiso_id INTEGER UNSIGNED  NOT NULL   AUTO_INCREMENT,
  modulo_id INTEGER UNSIGNED  NOT NULL  ,
  permiso_descripcion VARCHAR(50)  NULL    ,
PRIMARY KEY(permiso_id)  ,
INDEX permisos_FKIndex1(modulo_id),
  FOREIGN KEY(modulo_id)
    REFERENCES modulos(modulo_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);



CREATE TABLE usuarios (
  usuario_id INTEGER UNSIGNED  NOT NULL   AUTO_INCREMENT,
  persona_id INTEGER UNSIGNED  NOT NULL  ,
  estado_usuario_id INTEGER UNSIGNED  NOT NULL  ,
  usuario_email VARCHAR(50)  NULL  ,
  usuario_pass VARCHAR(255)  NULL    ,
PRIMARY KEY(usuario_id)  ,
INDEX usuarios_FKIndex1(persona_id)  ,
INDEX usuarios_FKIndex2(estado_usuario_id),
  FOREIGN KEY(persona_id)
    REFERENCES personas(persona_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
  FOREIGN KEY(estado_usuario_id)
    REFERENCES estados_usuarios(estado_usuario_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);



CREATE TABLE perfiles_modulos (
  modulo_id INTEGER UNSIGNED  NOT NULL  ,
  perfil_id INTEGER UNSIGNED  NOT NULL    ,
INDEX perfiles_has_modulos_FKIndex1(perfil_id)  ,
INDEX perfiles_has_modulos_FKIndex2(modulo_id),
  FOREIGN KEY(perfil_id)
    REFERENCES perfiles(perfil_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
  FOREIGN KEY(modulo_id)
    REFERENCES modulos(modulo_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);



CREATE TABLE usuarios_modulos_permisos (
  ump_id INTEGER UNSIGNED  NOT NULL   AUTO_INCREMENT,
  permiso_id INTEGER UNSIGNED  NOT NULL  ,
  modulo_id INTEGER UNSIGNED  NOT NULL  ,
  usuario_id INTEGER UNSIGNED  NOT NULL    ,
PRIMARY KEY(ump_id)  ,
INDEX usuario_modulo_permiso_FKIndex1(usuario_id)  ,
INDEX usuario_modulo_permiso_FKIndex2(modulo_id)  ,
INDEX usuario_modulo_permiso_FKIndex3(permiso_id),
  FOREIGN KEY(usuario_id)
    REFERENCES usuarios(usuario_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
  FOREIGN KEY(modulo_id)
    REFERENCES modulos(modulo_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
  FOREIGN KEY(permiso_id)
    REFERENCES permisos(permiso_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);



CREATE TABLE usuarios_perfiles (
  perfil_id INTEGER UNSIGNED  NOT NULL  ,
  usuario_id INTEGER UNSIGNED  NOT NULL    ,
INDEX usuarios_has_perfiles_FKIndex1(usuario_id)  ,
INDEX usuarios_has_perfiles_FKIndex2(perfil_id),
  FOREIGN KEY(usuario_id)
    REFERENCES usuarios(usuario_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
  FOREIGN KEY(perfil_id)
    REFERENCES perfiles(perfil_id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);




